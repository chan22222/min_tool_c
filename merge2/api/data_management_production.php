<?php
// 프로덕션 버전 - 에러 출력 비활성화
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

// 대용량 파일 처리를 위한 설정 (10GB+)
ini_set('memory_limit', '-1'); // 무제한
ini_set('max_execution_time', 0); // 무제한
set_time_limit(0); // 실행 시간 무제한

require_once 'config.php';
require_once 'project_hash.php';

// 헤더 설정
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $pdo = getDBConnection();
} catch(Exception $e) {
    handleError('Database connection failed: ' . $e->getMessage());
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch($action) {
    case 'export':
        exportData($pdo);
        break;
        
    case 'import':
        importData($pdo);
        break;
        
    case 'reset':
        resetData($pdo);
        break;
        
    default:
        handleError('Invalid action: ' . $action);
}

// 여기에 위에서 정의한 모든 함수들을 복사하세요
// exportData(), importData(), resetData()
?>