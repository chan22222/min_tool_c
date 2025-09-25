<?php
// JSON 응답이 깨지지 않도록 에러 출력 비활성화
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);

// 사이트 기본 URL 동적 설정
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'minc.dothome.co.kr';
$script_path = dirname($_SERVER['SCRIPT_NAME'] ?? '/merge2/api');
$base_path = str_replace('/api', '', $script_path);

define('BASE_URL', $protocol . '://' . $host . $base_path);
define('UPLOAD_URL', BASE_URL . '/uploads/');

// 데이터베이스 설정
define('DB_HOST', 'localhost');
define('DB_NAME', 'minc');
define('DB_USER', 'minc');
define('DB_PASS', 'min0101!');

// 업로드 디렉토리 설정
define('UPLOAD_DIR', '../uploads/');
define('MAX_FILE_SIZE', 52428800); // 50MB

// CORS 헤더 설정
if (!headers_sent()) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');
}

// OPTIONS 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 데이터베이스 연결 함수
function getDBConnection() {
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec("SET NAMES utf8mb4");
        return $pdo;
    } catch (PDOException $e) {
        throw new Exception('Database connection failed: ' . $e->getMessage());
    }
}

// 응답 헬퍼 함수
function sendResponse($success, $data = null, $message = '') {
    $response = array(
        'success' => $success,
        'data' => $data,
        'message' => $message
    );
    
    echo json_encode($response);
    exit();
}

// 에러 핸들러
function handleError($message, $code = 500) {
    http_response_code($code);
    sendResponse(false, null, $message);
}

// 업로드 디렉토리 생성
if (!file_exists(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}
?>