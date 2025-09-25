<?php
// api-optimized.php - 스마트 API 호출 최적화

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

@ini_set('display_errors', '0');
@error_reporting(0);

require_once __DIR__ . '/config.php';

// ====== 다중 API 키 로테이션 ======
// config.php에 여러 API 키를 설정하면 자동 로테이션
$API_KEYS = [
    [
        'customer_id' => NAVER_CUSTOMER_ID,
        'access_license' => NAVER_ACCESS_LICENSE,
        'secret_key' => NAVER_SECRET_KEY,
        'last_used' => 0,
        'request_count' => 0
    ],
    // 추가 API 키가 있다면 여기에 추가
    // [
    //     'customer_id' => NAVER_CUSTOMER_ID_2,
    //     'access_license' => NAVER_ACCESS_LICENSE_2,
    //     'secret_key' => NAVER_SECRET_KEY_2,
    //     'last_used' => 0,
    //     'request_count' => 0
    // ],
];

$current_key_index = 0;
$rate_limit_tracker = [];

function get_next_api_key(&$keys, &$index) {
    // 라운드 로빈 방식으로 API 키 순환
    $index = ($index + 1) % count($keys);
    return $keys[$index];
}

function adaptive_delay($attempt, $base_interval) {
    // 적응형 딜레이: 실패할수록 딜레이 증가
    if ($attempt == 0) return $base_interval;
    if ($attempt == 1) return $base_interval * 1.5;
    if ($attempt == 2) return $base_interval * 2;
    return $base_interval * 3;
}

function call_keyword_tool_smart($kw, &$httpCodeOut=null, &$bodyOut=null) {
    global $API_KEYS, $current_key_index;
    
    $max_attempts = count($API_KEYS) * 2; // 모든 키로 2회씩 시도
    
    for ($attempt = 0; $attempt < $max_attempts; $attempt++) {
        $api_key = get_next_api_key($API_KEYS, $current_key_index);
        
        $ts = (string) round(microtime(true) * 1000);
        $msg = $ts . '.GET.' . NAVER_API_PATH;
        $sig = base64_encode(hash_hmac('sha256', $msg, $api_key['secret_key'], true));
        
        $qs = http_build_query([
            'hintKeywords' => $kw,
            'includeHintKeywords' => '1',
            'showDetail' => '1',
        ]);
        
        $url = NAVER_API_BASE . NAVER_API_PATH . '?' . $qs;
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'X-Timestamp: ' . $ts,
                'X-API-KEY: ' . $api_key['access_license'],
                'X-Customer: ' . $api_key['customer_id'],
                'X-Signature: ' . $sig,
                'Content-Type: application/json;charset=UTF-8',
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        ]);
        
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $httpCodeOut = $code;
        $bodyOut = $resp;
        
        if ($code === 200) {
            $API_KEYS[$current_key_index]['last_used'] = time();
            $API_KEYS[$current_key_index]['request_count']++;
            return true;
        }
        
        if ($code === 429) {
            // 429 에러시 다음 API 키로 즉시 전환
            continue;
        }
        
        if ($code >= 500) {
            // 서버 에러시 잠시 대기 후 재시도
            usleep(500 * 1000); // 0.5초 대기
            continue;
        }
        
        // 기타 에러는 즉시 실패 처리
        break;
    }
    
    return false;
}

// 배치 병렬 처리를 위한 멀티 컬 사용
function batch_process_keywords($keywords, $interval_ms) {
    $results = [];
    $multi_handle = curl_multi_init();
    $curl_handles = [];
    
    // 한번에 처리할 최대 연결 수
    $max_concurrent = 5;
    $running = 0;
    $index = 0;
    
    while ($index < count($keywords) || $running > 0) {
        // 새 연결 추가
        while ($running < $max_concurrent && $index < count($keywords)) {
            $kw = $keywords[$index];
            
            // curl 핸들 생성 (실제 API 호출 설정)
            // ... (API 호출 코드)
            
            $index++;
            $running++;
        }
        
        // 실행 및 대기
        curl_multi_exec($multi_handle, $running);
        curl_multi_select($multi_handle);
        
        // 완료된 요청 처리
        while ($info = curl_multi_info_read($multi_handle)) {
            // 결과 수집
            $running--;
        }
    }
    
    curl_multi_close($multi_handle);
    return $results;
}

// ====== 입력 처리 ======
$body = json_decode(file_get_contents('php://input'), true);
$keywordsText = trim($body['keywordsText'] ?? '');

if ($keywordsText === '') {
    http_response_code(400);
    echo json_encode(['error' => '키워드를 입력하세요.']);
    exit;
}

$CONCURRENCY = max(1, min(10, intval($body['concurrency'] ?? 3)));
$REQUEST_INTERVAL_MS = max(50, min(5000, intval($body['requestIntervalMs'] ?? 100)));
$MAX_RETRIES = max(0, min(5, intval($body['maxRetries'] ?? 2)));

// 스마트 모드: 자동으로 간격 조절
$USE_SMART_MODE = $body['smartMode'] ?? true;

$parts = preg_split('/\r?\n|,/', $keywordsText);
$keywords = array_filter(array_map('trim', $parts));

if (!count($keywords)) {
    http_response_code(400);
    echo json_encode(['error' => '키워드를 한 개 이상 입력하세요.']);
    exit;
}

$results = [];
$consecutive_429 = 0;

for ($offset = 0; $offset < count($keywords); $offset += $CONCURRENCY) {
    $batch = array_slice($keywords, $offset, $CONCURRENCY);
    
    foreach ($batch as $i => $kw) {
        $g = $offset + $i;
        $code = 0;
        $resp = '';
        $attempt = 0;
        $ok = false;
        
        do {
            $ok = call_keyword_tool_smart($kw, $code, $resp);
            
            if ($ok) {
                $consecutive_429 = 0;
                break;
            }
            
            if ($code === 429) {
                $consecutive_429++;
                
                // 스마트 모드: 429 연속 발생시 자동으로 간격 증가
                if ($USE_SMART_MODE && $consecutive_429 > 2) {
                    $REQUEST_INTERVAL_MS = min($REQUEST_INTERVAL_MS * 1.5, 1000);
                }
                
                if ($attempt < $MAX_RETRIES) {
                    $backoff = adaptive_delay($attempt, $REQUEST_INTERVAL_MS);
                    usleep($backoff * 1000);
                    $attempt++;
                    continue;
                }
            }
            
            break;
        } while (true);
        
        if ($ok) {
            $json = json_decode($resp, true);
            $list = $json['keywordList'] ?? [];
            $row = null;
            
            foreach ($list as $it) {
                $rk = $it['relKeyword'] ?? '';
                if (strcasecmp($rk, $kw) === 0) {
                    $row = $it;
                    break;
                }
            }
            
            $pc = intval(str_replace(['<', ' '], '', $row['monthlyPcQcCnt'] ?? '0'));
            $mo = intval(str_replace(['<', ' '], '', $row['monthlyMobileQcCnt'] ?? '0'));
            
            $results[$g] = [
                'keyword' => $kw,
                'monthlyPcQcCnt' => $pc,
                'monthlyMobileQcCnt' => $mo,
                'total' => $pc + $mo,
                'compIdx' => $row['compIdx'] ?? '',
                'plAvgDepth' => $row['plAvgDepth'] ?? '',
                'monthlyAvePcCtr' => $row['monthlyAvePcCtr'] ?? '',
                'monthlyAveMobileCtr' => $row['monthlyAveMobileCtr'] ?? '',
                'monthlyAvePcClkCnt' => $row['monthlyAvePcClkCnt'] ?? '',
                'monthlyAveMobileClkCnt' => $row['monthlyAveMobileClkCnt'] ?? '',
                'error' => '',
            ];
        } else {
            $results[$g] = [
                'keyword' => $kw,
                'error' => 'API ' . $code
            ];
        }
        
        // 동적 간격 조절
        if ($USE_SMART_MODE) {
            if ($consecutive_429 == 0 && $REQUEST_INTERVAL_MS > 100) {
                // 성공시 간격 점진적 감소
                $REQUEST_INTERVAL_MS = max(50, $REQUEST_INTERVAL_MS * 0.9);
            }
        }
        
        usleep($REQUEST_INTERVAL_MS * 1000);
    }
    
    usleep($REQUEST_INTERVAL_MS * 1000);
}

echo json_encode([
    'rows' => $results,
    'stats' => [
        'final_interval' => $REQUEST_INTERVAL_MS,
        'api_keys_used' => count($API_KEYS),
        '429_errors' => $consecutive_429
    ]
], JSON_UNESCAPED_UNICODE);