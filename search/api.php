<?php
// api.php — 멀티 API 프록시 (최대 5개 API 순차 시도)
// - 재시도 제거, API 실패 시 다음 API로 자동 전환
// - "< 10" → 0
// - 항상 JSON만 출력

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// PHP 에러가 HTML로 섞여 나오지 않도록
@ini_set('display_errors', '0');
@error_reporting(0);

require_once __DIR__ . '/config.php';

// ---- helpers ----
function read_json_body() {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function norm0($val) { // "< 10"은 0으로 환산
  if ($val === null) return 0;
  if (is_string($val) && strpos($val, '<') !== false) return 0;
  if (is_numeric($val)) return (int)$val;
  return 0;
}
function sign_naver($method, $uriPath, $timestamp, $secret) {
  $msg = $timestamp . '.' . $method . '.' . $uriPath;
  return base64_encode(hash_hmac('sha256', $msg, $secret, true));
}

// 멀티 API 지원 함수 - 모든 API를 순차적으로 시도
function call_keyword_tool_with_fallback($kw, &$usedApiIndex=null, &$apiName=null) {
  global $API_CONFIGS;
  
  // 각 API를 순차적으로 시도
  foreach ($API_CONFIGS as $index => $api) {
    $ts = (string) round(microtime(true) * 1000);
    $sig = sign_naver('GET', NAVER_API_PATH, $ts, $api['SECRET_KEY']);
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
        'X-API-KEY: ' . $api['ACCESS_LICENSE'],
        'X-Customer: ' . $api['CUSTOMER_ID'],
        'X-Signature: ' . $sig,
        'Content-Type: application/json;charset=UTF-8',
      ],
      CURLOPT_TIMEOUT => 30,      CURLOPT_FOLLOWLOCATION => false,
      CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    ]);
    
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // 성공한 경우 해당 API 정보와 함께 반환
    if ($code === 200) {
      $usedApiIndex = $index;
      $apiName = $api['NAME'];
      return ['success' => true, 'data' => $resp, 'api_index' => $index, 'api_name' => $api['NAME']];
    }
    
    // 429(Rate Limit) 또는 5xx 에러인 경우 다음 API로 시도
    // 4xx(429 제외) 에러는 키워드 자체 문제일 가능성이 높으므로 다음 API 시도 안함
    if ($code === 429 || $code >= 500) {
      continue; // 다음 API 시도
    } else {
      // 다른 에러는 더 이상 시도하지 않음
      return ['success' => false, 'error' => "API Error $code: $resp", 'code' => $code];
    }
  }
  
  // 모든 API 실패
  return ['success' => false, 'error' => 'All APIs failed or rate limited'];
}
// ---- input ----
$body = read_json_body();
$keywordsText = trim($body['keywordsText'] ?? '');
if ($keywordsText === '') {
  http_response_code(400);
  echo json_encode(['error' => '키워드를 입력하세요.']); 
  exit;
}

$REQUEST_INTERVAL_MS = max(100, min(5000, intval($body['requestIntervalMs'] ?? DEFAULT_REQUEST_INTERVAL_MS)));

// API가 하나도 없는 경우 체크
if (empty($API_CONFIGS)) {
  http_response_code(500);
  echo json_encode(['error' => 'No API configurations available']);
  exit;
}

// ---- parse keywords ----
$parts = preg_split('/\r?\n|,/', $keywordsText);
$keywords = [];
foreach ($parts as $p) { 
  $t = trim($p); 
  if ($t !== '') $keywords[] = $t; 
}

if (!count($keywords)) { 
  http_response_code(400); 
  echo json_encode(['error'=>'키워드를 한 개 이상 입력하세요.']);
  exit; 
}
// ---- 실행: 순차 처리 with API 전환 ----
$results = [];
$apiUsageStats = []; // API 사용 통계

foreach ($keywords as $kw) {
  $usedApiIndex = null;
  $apiName = null;
  $result = call_keyword_tool_with_fallback($kw, $usedApiIndex, $apiName);
  
  if ($result['success']) {
    // API 사용 통계 업데이트
    if (!isset($apiUsageStats[$apiName])) {
      $apiUsageStats[$apiName] = 0;
    }
    $apiUsageStats[$apiName]++;
    
    // 응답 파싱
    $json = json_decode($result['data'], true);
    $list = $json['keywordList'] ?? [];
    $row = null;
    
    foreach ($list as $it) {
      $rk = $it['relKeyword'] ?? '';
      if ($rk === $kw || mb_strtolower($rk,'UTF-8') === mb_strtolower($kw,'UTF-8')) { 
        $row = $it; 
        break; 
      }
    }
    
    $pc = norm0($row['monthlyPcQcCnt'] ?? null);
    $mo = norm0($row['monthlyMobileQcCnt'] ?? null);    
    $results[] = [
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
      'api_used' => $apiName // 사용된 API 정보 추가
    ];
  } else {
    $results[] = [ 
      'keyword' => $kw, 
      'error' => $result['error'],
      'api_used' => 'Failed'
    ];
  }
  
  // 요청 간 간격
  usleep($REQUEST_INTERVAL_MS * 1000);
}

// ---- 결과 반환 ----
echo json_encode([ 
  'rows' => $results, 
  'apiStats' => $apiUsageStats,
  'totalApis' => count($API_CONFIGS),
  'csv' => '' 
], JSON_UNESCAPED_UNICODE);