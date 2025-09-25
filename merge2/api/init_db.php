<?php
require_once 'config.php';

try {
    $pdo = getDBConnection();
    
    // projects 테이블 생성
    $sql1 = "CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        categories TEXT,
        category_preview_counts TEXT,
        selected_images TEXT,
        thumbnail_size INT DEFAULT 100,
        category_counter INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql1);
    
    // project_images 테이블 생성
    $sql2 = "CREATE TABLE IF NOT EXISTS project_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        category_name VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255),
        stored_filename VARCHAR(255) NOT NULL,
        file_size INT,
        mime_type VARCHAR(100),
        file_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project (project_name),
        INDEX idx_category (category_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql2);
    
    // 테이블 확인
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $data = array(
        'tables_created' => $tables,
        'message' => 'Tables created successfully'
    );
    
    sendResponse(true, $data, 'Database initialized successfully');
    
} catch (Exception $e) {
    handleError('Failed to create tables: ' . $e->getMessage());
}
?>