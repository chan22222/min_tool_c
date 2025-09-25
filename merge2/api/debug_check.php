<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== PHP 환경 정보 ===\n";
echo "PHP Version: " . phpversion() . "\n\n";

echo "=== 에러 로그 확인 ===\n";

// 에러 로그 파일 확인
$error_log = __DIR__ . '/projects_error_log.txt';
if (file_exists($error_log)) {
    echo "projects_error_log.txt (최근 20줄):\n";
    $lines = file($error_log);
    $recent = array_slice($lines, -20);
    foreach ($recent as $line) {
        echo $line;
    }
} else {
    echo "projects_error_log.txt 파일이 없습니다.\n";
}

echo "\n=== 프로젝트 로그 확인 ===\n";

// 프로젝트 로그 파일 확인
$project_log = __DIR__ . '/projects_log.txt';
if (file_exists($project_log)) {
    echo "projects_log.txt (최근 30줄):\n";
    $lines = file($project_log);
    $recent = array_slice($lines, -30);
    foreach ($recent as $line) {
        echo $line;
    }
} else {
    echo "projects_log.txt 파일이 없습니다.\n";
}

echo "\n=== 데이터베이스 연결 테스트 ===\n";

try {
    require_once 'config.php';
    $pdo = getDBConnection();
    echo "✅ DB 연결 성공\n";
    
    // 테이블 확인
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "테이블 목록: " . implode(', ', $tables) . "\n";
    
    // projects 테이블 구조 확인
    echo "\n=== projects 테이블 구조 ===\n";
    $stmt = $pdo->query("DESCRIBE projects");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo $col['Field'] . " (" . $col['Type'] . ")\n";
    }
    
} catch (Exception $e) {
    echo "❌ DB 연결 실패: " . $e->getMessage() . "\n";
}

echo "\n=== 최근 프로젝트 확인 ===\n";
try {
    $stmt = $pdo->query("SELECT name, created_at, updated_at FROM projects ORDER BY updated_at DESC LIMIT 5");
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($projects) > 0) {
        foreach ($projects as $p) {
            echo "- " . $p['name'] . " (생성: " . $p['created_at'] . ", 수정: " . $p['updated_at'] . ")\n";
        }
    } else {
        echo "프로젝트가 없습니다.\n";
    }
} catch (Exception $e) {
    echo "프로젝트 조회 실패: " . $e->getMessage() . "\n";
}

echo "\n=== uploads 폴더 권한 확인 ===\n";
$upload_dir = '../uploads';
if (is_dir($upload_dir)) {
    echo "uploads 폴더 존재: ✅\n";
    echo "쓰기 가능: " . (is_writable($upload_dir) ? "✅" : "❌") . "\n";
} else {
    echo "uploads 폴더 없음 ❌\n";
}
?>