<?php
// api_batch.php - 개별 키워드 처리용 최적화 버전
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// PHP 에러 방지
@ini_set('display_errors', '0');
@error_reporting(0);

// 네이버 API 상수
const NAVER_API_BASE = 'https://api.searchad.naver.com';
const NAVER_API_PATH = '/keywordstool';

// JSON 바디 읽기
function read_json_body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// "< 10" 처리
function norm0($val) {
    if ($val === null) return 0;
    if (is_string($val) && strpos($val, '<') !== false) return 0;
    if (is_numeric($val)) return (int)$val;
    return 0;
}

// 네이버 서명 생성
function sign_naver($method, $uriPath, $timestamp, $secret) {
    $msg = $timestamp . '.' . $method . '.' . $uriPath;
    return base64_encode(hash_hmac('sha256', $msg, $secret, true));
}

// API 호출 - 단일 키워드
function call_naver_api($keyword, $apiConfig) {
    $ts = (string) round(microtime(true) * 1000);
    $sig = sign_naver('GET', NAVER_API_PATH, $ts, $apiConfig['secretKey']);
    
    $qs = http_build_query([
        'hintKeywords' => $keyword,
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
            'X-API-KEY: ' . $apiConfig['accessLicense'],
            'X-Customer: ' . $apiConfig['customerId'],
            'X-Signature: ' . $sig,
            'Content-Type: application/json;charset=UTF-8',
        ],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    ]);
    
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($code === 200) {
        return ['success' => true, 'data' => $resp];
    }
    
    // 에러 코드에 따른 메시지
    $errorMsg = "API Error $code";
    $errorDetail = "";
    if ($code === 429) {
        $errorMsg = "Rate Limit";
        $errorDetail = " (일일 한도 초과)";
    } else if ($code === 401) {
        $errorMsg = "인증 실패";
        $errorDetail = " (API 키 확인 필요)";
    } else if ($code === 500) {
        $errorMsg = "서버 오류";
        $errorDetail = " (네이버 서버 문제)";
    }
    
    return ['success' => false, 'error' => $errorMsg . $errorDetail, 'code' => $code];
}

// 메인 처리
$body = read_json_body();

// 필수 파라미터 확인
$keyword = trim($body['keyword'] ?? '');
$apiConfig = $body['apiConfig'] ?? [];
$apiName = $body['apiName'] ?? 'API';

if ($keyword === '') {
    http_response_code(400);
    echo json_encode(['error' => '키워드를 입력하세요.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($apiConfig['customerId']) || 
    empty($apiConfig['accessLicense']) || 
    empty($apiConfig['secretKey'])) {
    http_response_code(400);
    echo json_encode(['error' => 'API 설정이 올바르지 않습니다.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// API 호출 시도
$apiResult = call_naver_api($keyword, $apiConfig);

if ($apiResult['success']) {
    $json = json_decode($apiResult['data'], true);
    $list = $json['keywordList'] ?? [];
    
    // 정확한 키워드 찾기
    foreach ($list as $item) {
        $rk = $item['relKeyword'] ?? '';
        if ($rk === $keyword || mb_strtolower($rk, 'UTF-8') === mb_strtolower($keyword, 'UTF-8')) {
            $pc = norm0($item['monthlyPcQcCnt'] ?? null);
            $mo = norm0($item['monthlyMobileQcCnt'] ?? null);
            
            $result = [
                'keyword' => $keyword,
                'monthlyPcQcCnt' => $pc,
                'monthlyMobileQcCnt' => $mo,
                'total' => $pc + $mo,
                'compIdx' => $item['compIdx'] ?? '',
                'plAvgDepth' => $item['plAvgDepth'] ?? '',
                'monthlyAvePcCtr' => $item['monthlyAvePcCtr'] ?? '',
                'monthlyAveMobileCtr' => $item['monthlyAveMobileCtr'] ?? '',
                'monthlyAvePcClkCnt' => $item['monthlyAvePcClkCnt'] ?? '',
                'monthlyAveMobileClkCnt' => $item['monthlyAveMobileClkCnt'] ?? '',
                'api_used' => $apiName,
                'error' => ''
            ];
            
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    
    // 키워드를 찾지 못함
    $result = [
        'keyword' => $keyword,
        'error' => '키워드 데이터 없음',
        'api_used' => $apiName
    ];
} else {
    // API 호출 실패
    $code = $apiResult['code'] ?? 500;
    
    // 에러 코드에 따라 HTTP 상태 코드 설정
    if ($code === 429) {
        http_response_code(429);
    } else if ($code === 401) {
        http_response_code(401);
    } else if ($code === 500) {
        http_response_code(500);
    } else {
        http_response_code(400);
    }
    
    $result = [
        'keyword' => $keyword,
        'error' => $apiResult['error'],
        'api_used' => $apiName,
        'code' => $code
    ];
}

// JSON 응답
echo json_encode($result, JSON_UNESCAPED_UNICODE);
?>