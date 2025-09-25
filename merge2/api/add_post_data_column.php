<?php
require_once 'config.php';

try {
    $pdo = getDBConnection();
    
    // post_data 컬럼이 있는지 확인
    $stmt = $pdo->query("SHOW COLUMNS FROM projects LIKE 'post_data'");
    $column = $stmt->fetch();
    
    if (!$column) {
        // post_data 컬럼 추가
        $sql = "ALTER TABLE projects ADD COLUMN post_data TEXT DEFAULT NULL AFTER category_counter";
        $pdo->exec($sql);
        echo json_encode([
            'success' => true,
            'message' => 'post_data column added successfully'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'post_data column already exists'
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add post_data column: ' . $e->getMessage()
    ]);
}
?>
