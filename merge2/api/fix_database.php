<?php
// 데이터베이스 구조 수정 스크립트
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔧 데이터베이스 구조 수정</h1>";

try {
    echo "<h2>1. config.php 로드</h2>";
    require_once 'config.php';
    echo "✅ config.php 로드 성공<br>";
    
    echo "<h2>2. 데이터베이스 연결</h2>";
    $pdo = getDBConnection();
    echo "✅ 데이터베이스 연결 성공<br>";
    
    echo "<h2>3. 기존 테이블 확인</h2>";
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "현재 테이블들:<br>";
    foreach ($tables as $table) {
        echo "- $table<br>";
    }
    
    echo "<h2>4. 외래키 제약조건 제거</h2>";
    
    // 외래키 제약조건 확인 및 제거
    if (in_array('images', $tables)) {
        echo "images 테이블의 외래키 제약조건 확인 중...<br>";
        
        // 외래키 제약조건 조회
        $stmt = $pdo->query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
                             WHERE TABLE_SCHEMA = DATABASE() 
                             AND TABLE_NAME = 'images' 
                             AND REFERENCED_TABLE_NAME IS NOT NULL");
        $constraints = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($constraints as $constraint) {
            echo "외래키 제약조건 제거 중: $constraint<br>";
            $pdo->exec("ALTER TABLE `images` DROP FOREIGN KEY `$constraint`");
            echo "✅ 외래키 제약조건 제거 완료: $constraint<br>";
        }
    }
    
    echo "<h2>5. 잘못된 테이블 삭제</h2>";
    
    // 잘못된 구조의 테이블들 삭제 (외래키 제약조건 제거 후)
    $tables_to_drop = ['projects', 'images'];
    
    foreach ($tables_to_drop as $table) {
        if (in_array($table, $tables)) {
            echo "삭제 중: $table<br>";
            $pdo->exec("DROP TABLE IF EXISTS `$table`");
            echo "✅ $table 삭제 완료<br>";
        } else {
            echo "⚠️ $table 테이블이 존재하지 않음<br>";
        }
    }
    
    echo "<h2>6. 올바른 테이블 생성</h2>";
    
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
    echo "✅ projects 테이블 생성 완료<br>";
    
    // project_images 테이블은 이미 올바른 구조이므로 유지
    echo "✅ project_images 테이블 유지 (올바른 구조)<br>";
    
    echo "<h2>7. 최종 테이블 확인</h2>";
    $stmt = $pdo->query("SHOW TABLES");
    $final_tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "최종 테이블들:<br>";
    foreach ($final_tables as $table) {
        echo "- $table<br>";
    }
    
    // projects 테이블 구조 확인
    if (in_array('projects', $final_tables)) {
        echo "<h3>projects 테이블 구조:</h3>";
        $stmt = $pdo->query("DESCRIBE projects");
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
    
    echo "<h2>✅ 데이터베이스 구조 수정 완료!</h2>";
    echo "<p>이제 <a href='../index.html' target='_blank'>메인 페이지</a>에서 프로젝트 생성을 테스트해보세요.</p>";
    
} catch (Exception $e) {
    echo "<h2>❌ 오류 발생</h2>";
    echo "오류 메시지: " . $e->getMessage() . "<br>";
    echo "오류 파일: " . $e->getFile() . "<br>";
    echo "오류 라인: " . $e->getLine() . "<br>";
    echo "스택 트레이스:<br><pre>" . $e->getTraceAsString() . "</pre>";
}
?>
