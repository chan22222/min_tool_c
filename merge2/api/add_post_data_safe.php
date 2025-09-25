<?php
// 에러 표시 비활성화 (프로덕션 환경)
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';

$response = [
    'success' => false,
    'message' => '',
    'step' => 0
];

try {
    $response['step'] = 1;
    $pdo = getDBConnection();
    
    $response['step'] = 2;
    // post_data 컬럼이 있는지 확인
    $stmt = $pdo->query("SHOW COLUMNS FROM projects LIKE 'post_data'");
    $column = $stmt->fetch();
    
    $response['step'] = 3;
    if (!$column) {
        // post_data 컬럼 추가 시도
        try {
            $sql = "ALTER TABLE projects ADD COLUMN post_data TEXT DEFAULT NULL";
            $pdo->exec($sql);
            $response['success'] = true;
            $response['message'] = 'post_data column added successfully';
        } catch (Exception $e) {
            // 컬럼 추가 실패 - 이미 있을 수도 있음
            $response['message'] = 'Column may already exist or error: ' . $e->getMessage();
            $response['success'] = false;
        }
    } else {
        $response['success'] = true;
        $response['message'] = 'post_data column already exists';
    }
    
} catch (Exception $e) {
    $response['message'] = 'Error at step ' . $response['step'] . ': ' . $e->getMessage();
}

echo json_encode($response);
?>