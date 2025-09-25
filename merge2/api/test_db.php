<?php
// 테스트 파일 - 데이터베이스 연결 및 테이블 확인

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Database Connection Test</h2>";

// config.php 확인
if (!file_exists('config.php')) {
    die('ERROR: config.php not found');
}

require_once 'config.php';

try {
    // 데이터베이스 연결
    $pdo = getDBConnection();
    echo "✅ Database connected successfully<br><br>";
    
    // 테이블 확인
    echo "<h3>Tables Check:</h3>";
    
    // projects 테이블 확인
    $stmt = $pdo->query("SHOW TABLES LIKE 'projects'");
    if ($stmt->rowCount() > 0) {
        echo "✅ 'projects' table exists<br>";
        
        // 레코드 수 확인
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM projects");
        $result = $stmt->fetch();
        echo "   - Records: " . $result['count'] . "<br>";
    } else {
        echo "❌ 'projects' table NOT found<br>";
    }
    
    // project_images 테이블 확인
    $stmt = $pdo->query("SHOW TABLES LIKE 'project_images'");
    if ($stmt->rowCount() > 0) {
        echo "✅ 'project_images' table exists<br>";
        
        // 레코드 수 확인
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM project_images");
        $result = $stmt->fetch();
        echo "   - Records: " . $result['count'] . "<br>";
    } else {
        echo "❌ 'project_images' table NOT found<br>";
    }
    
    echo "<br><h3>Reset Test (Dry Run):</h3>";
    
    // uploads 폴더 확인
    $uploads_dir = '../uploads';
    if (is_dir($uploads_dir)) {
        echo "✅ Uploads directory exists<br>";
        
        $folders = glob($uploads_dir . '/*', GLOB_ONLYDIR);
        $project_folders = 0;
        foreach ($folders as $folder) {
            if (strpos(basename($folder), 'project_') === 0) {
                $project_folders++;
            }
        }
        echo "   - Project folders: " . $project_folders . "<br>";
    } else {
        echo "❌ Uploads directory NOT found<br>";
    }
    
    echo "<br><h3>PHP Extensions:</h3>";
    echo "ZIP extension: " . (class_exists('ZipArchive') ? '✅ Installed' : '❌ Not installed') . "<br>";
    echo "JSON extension: " . (function_exists('json_encode') ? '✅ Installed' : '❌ Not installed') . "<br>";
    
    echo "<br><h3>PHP Settings:</h3>";
    echo "Memory limit: " . ini_get('memory_limit') . "<br>";
    echo "Max execution time: " . ini_get('max_execution_time') . " seconds<br>";
    echo "Post max size: " . ini_get('post_max_size') . "<br>";
    echo "Upload max filesize: " . ini_get('upload_max_filesize') . "<br>";
    
} catch(Exception $e) {
    echo "❌ ERROR: " . $e->getMessage();
}
?>