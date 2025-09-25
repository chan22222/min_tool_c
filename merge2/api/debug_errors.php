<?php
// 에러 로그 확인 페이지
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>에러 로그 확인</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .log-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .log-content { background: #f5f5f5; padding: 10px; border-radius: 3px; white-space: pre-wrap; font-family: monospace; }
        .error { color: red; }
        .success { color: green; }
        .warning { color: orange; }
        h2 { color: #333; }
        .refresh-btn { 
            background: #007cba; 
            color: white; 
            padding: 10px 20px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            margin: 10px 0;
        }
        .refresh-btn:hover { background: #005a87; }
    </style>
</head>
<body>
    <h1>🔍 에러 로그 확인</h1>
    
    <button class="refresh-btn" onclick="location.reload()">🔄 새로고침</button>
    
    <div class="log-section">
        <h2>📋 PHP 에러 로그</h2>
        <div class="log-content">
<?php
$error_log_file = __DIR__ . '/error_log.txt';
if (file_exists($error_log_file)) {
    $log_content = file_get_contents($error_log_file);
    if ($log_content) {
        echo htmlspecialchars($log_content);
    } else {
        echo "로그 파일이 비어있습니다.";
    }
} else {
    echo "에러 로그 파일이 존재하지 않습니다: " . $error_log_file;
}
?>
        </div>
    </div>
    
    <div class="log-section">
        <h2>🗄️ 데이터베이스 연결 테스트</h2>
        <div class="log-content">
<?php
try {
    require_once 'config.php';
    $pdo = getDBConnection();
    echo "✅ 데이터베이스 연결 성공\n";
    
    // 테이블 확인
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "📊 테이블 목록:\n";
    foreach ($tables as $table) {
        echo "  - $table\n";
    }
    
    // projects 테이블 레코드 수 확인
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM projects");
    $project_count = $stmt->fetch()['count'];
    echo "📁 프로젝트 수: $project_count\n";
    
    // project_images 테이블 레코드 수 확인
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM project_images");
    $image_count = $stmt->fetch()['count'];
    echo "🖼️ 이미지 레코드 수: $image_count\n";
    
} catch (Exception $e) {
    echo "❌ 데이터베이스 연결 실패: " . $e->getMessage() . "\n";
}
?>
        </div>
    </div>
    
    <div class="log-section">
        <h2>📁 파일 시스템 확인</h2>
        <div class="log-content">
<?php
$uploads_dir = '../uploads';
echo "📂 업로드 디렉토리: $uploads_dir\n";
echo "존재 여부: " . (is_dir($uploads_dir) ? "✅ 존재" : "❌ 존재하지 않음") . "\n";

if (is_dir($uploads_dir)) {
    $folders = glob($uploads_dir . '/*', GLOB_ONLYDIR);
    echo "📁 프로젝트 폴더 수: " . count($folders) . "\n";
    
    foreach ($folders as $folder) {
        $files = glob($folder . '/*');
        echo "  - " . basename($folder) . ": " . count($files) . "개 파일\n";
    }
}

echo "\n🔧 PHP 설정:\n";
echo "메모리 제한: " . ini_get('memory_limit') . "\n";
echo "최대 실행 시간: " . ini_get('max_execution_time') . "\n";
echo "POST 최대 크기: " . ini_get('post_max_size') . "\n";
echo "업로드 최대 크기: " . ini_get('upload_max_filesize') . "\n";
?>
        </div>
    </div>
    
    <div class="log-section">
        <h2>🔧 PHP 확장 확인</h2>
        <div class="log-content">
<?php
$required_extensions = ['pdo', 'pdo_mysql', 'zip', 'json'];
foreach ($required_extensions as $ext) {
    $status = extension_loaded($ext) ? "✅" : "❌";
    echo "$status $ext\n";
}
?>
        </div>
    </div>
    
    <script>
        // 30초마다 자동 새로고침
        setTimeout(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
