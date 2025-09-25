<?php
// 누락된 테이블 생성 스크립트
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔧 누락된 테이블 생성</h1>";

try {
    echo "<h2>1. config.php 로드</h2>";
    require_once 'config.php';
    echo "✅ config.php 로드 성공<br>";
    
    echo "<h2>2. 데이터베이스 연결</h2>";
    $pdo = getDBConnection();
    echo "✅ 데이터베이스 연결 성공<br>";
    
    echo "<h2>3. 현재 테이블 확인</h2>";
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "현재 테이블들:<br>";
    foreach ($tables as $table) {
        echo "- $table<br>";
    }
    
    echo "<h2>4. 누락된 테이블 생성</h2>";
    
    // project_images 테이블이 없으면 생성
    if (!in_array('project_images', $tables)) {
        echo "project_images 테이블 생성 중...<br>";
        
        $sql = "CREATE TABLE IF NOT EXISTS project_images (
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
        
        $pdo->exec($sql);
        echo "✅ project_images 테이블 생성 완료<br>";
    } else {
        echo "✅ project_images 테이블이 이미 존재합니다<br>";
    }
    
    echo "<h2>5. 최종 테이블 확인</h2>";
    $stmt = $pdo->query("SHOW TABLES");
    $final_tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "최종 테이블들:<br>";
    foreach ($final_tables as $table) {
        echo "- $table<br>";
    }
    
    // project_images 테이블 구조 확인
    if (in_array('project_images', $final_tables)) {
        echo "<h3>project_images 테이블 구조:</h3>";
        $stmt = $pdo->query("DESCRIBE project_images");
        $columns = $stmt->fetchAll();
        echo "<table border='1'>";
        echo "<tr><th>필드</th><th>타입</th><th>NULL</th><th>키</th><th>기본값</th></tr>";
        foreach ($columns as $column) {
            echo "<tr>";
            echo "<td>{$column['Field']}</td>";
            echo "<td>{$column['Type']}</td>";
            echo "<td>{$column['Null']}</td>";
            echo "<td>{$column['Key']}</td>";
            echo "<td>{$column['Default']}</td>";
            echo "</tr>";
        }
        echo "</table>";
    }
    
    echo "<h2>✅ 테이블 생성 완료!</h2>";
    echo "<p>이제 다음 URL들을 테스트해보세요:</p>";
    echo "<ul>";
    echo "<li><a href='test_projects_simple.php' target='_blank'>간단한 프로젝트 API 테스트</a></li>";
    echo "<li><a href='projects.php' target='_blank'>원본 프로젝트 API 테스트</a></li>";
    echo "<li><a href='../index.html' target='_blank'>메인 페이지</a></li>";
    echo "</ul>";
    
} catch (Exception $e) {
    echo "<h2>❌ 오류 발생</h2>";
    echo "오류 메시지: " . $e->getMessage() . "<br>";
    echo "오류 파일: " . $e->getFile() . "<br>";
    echo "오류 라인: " . $e->getLine() . "<br>";
    echo "스택 트레이스:<br><pre>" . $e->getTraceAsString() . "</pre>";
}
?>
