<?php
// 새로운 호스팅 설정 테스트
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔧 새로운 호스팅 설정 테스트</h1>";

try {
    echo "<h2>1. config.php 로드</h2>";
    require_once 'config.php';
    echo "✅ config.php 로드 성공<br>";
    
    echo "<h2>2. 데이터베이스 설정 확인</h2>";
    echo "DB_HOST: " . DB_HOST . "<br>";
    echo "DB_NAME: " . DB_NAME . "<br>";
    echo "DB_USER: " . DB_USER . "<br>";
    echo "DB_PASS: " . str_repeat('*', strlen(DB_PASS)) . "<br>";
    
    echo "<h2>3. 데이터베이스 연결 테스트</h2>";
    $pdo = getDBConnection();
    echo "✅ 데이터베이스 연결 성공<br>";
    
    echo "<h2>4. 데이터베이스 정보</h2>";
    $stmt = $pdo->query("SELECT VERSION() as version");
    $version = $stmt->fetch()['version'];
    echo "MySQL 버전: $version<br>";
    
    echo "<h2>5. 테이블 존재 확인</h2>";
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($tables)) {
        echo "❌ 테이블이 없습니다. init_db.php를 실행해야 합니다.<br>";
        echo "<a href='init_db.php' target='_blank'>데이터베이스 초기화 실행</a><br>";
    } else {
        echo "✅ 발견된 테이블:<br>";
        foreach ($tables as $table) {
            echo "- $table<br>";
        }
        
        // projects 테이블 구조 확인
        if (in_array('projects', $tables)) {
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
        
        // project_images 테이블 구조 확인
        if (in_array('project_images', $tables)) {
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
    }
    
    echo "<h2>6. 업로드 디렉토리 확인</h2>";
    $upload_dir = '../uploads';
    echo "업로드 디렉토리: $upload_dir<br>";
    echo "존재 여부: " . (is_dir($upload_dir) ? "✅ 존재" : "❌ 존재하지 않음") . "<br>";
    echo "쓰기 권한: " . (is_writable($upload_dir) ? "✅ 쓰기 가능" : "❌ 쓰기 불가") . "<br>";
    
    if (!is_dir($upload_dir)) {
        echo "업로드 디렉토리 생성 시도...<br>";
        if (@mkdir($upload_dir, 0755, true)) {
            echo "✅ 업로드 디렉토리 생성 성공<br>";
        } else {
            echo "❌ 업로드 디렉토리 생성 실패<br>";
        }
    }
    
    echo "<h2>7. PHP 설정 확인</h2>";
    echo "PHP 버전: " . PHP_VERSION . "<br>";
    echo "memory_limit: " . ini_get('memory_limit') . "<br>";
    echo "max_execution_time: " . ini_get('max_execution_time') . "<br>";
    echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "<br>";
    echo "post_max_size: " . ini_get('post_max_size') . "<br>";
    
    echo "<h2>✅ 설정 테스트 완료!</h2>";
    
} catch (Exception $e) {
    echo "<h2>❌ 오류 발생</h2>";
    echo "오류 메시지: " . $e->getMessage() . "<br>";
    echo "오류 파일: " . $e->getFile() . "<br>";
    echo "오류 라인: " . $e->getLine() . "<br>";
    echo "스택 트레이스:<br><pre>" . $e->getTraceAsString() . "</pre>";
}
?>
