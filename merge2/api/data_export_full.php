<?php
// JSON 응답이 깨지지 않도록 에러 출력 비활성화
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);

// 대용량 파일 처리를 위한 설정 (10GB+)
ini_set('memory_limit', '512M'); // 적절한 메모리 제한
ini_set('max_execution_time', 300); // 5분 제한
set_time_limit(300);

require_once 'config.php';
require_once 'project_hash.php';

try {
    $pdo = getDBConnection();
} catch(Exception $e) {
    die('Database connection failed: ' . $e->getMessage());
}

// ZIP 확장 확인
if (!class_exists('ZipArchive')) {
    die('ZIP extension is not installed on this server');
}

// 임시 디렉토리 생성
$temp_dir = sys_get_temp_dir() . '/photo_classifier_export_' . uniqid();
if (!mkdir($temp_dir, 0777, true)) {
    die('Failed to create temporary directory');
}

try {
    // 출력 버퍼링 시작 (대용량 파일용)
    ob_start();
    
    // 1. SQL 데이터 준비 (메모리 효율적으로)
    $exportData = array();
    
    // projects 테이블 데이터 가져오기
    $stmt = $pdo->query("SELECT * FROM projects ORDER BY created_at ASC");
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // project_images 테이블 데이터 가져오기
    $stmt = $pdo->query("SELECT * FROM project_images ORDER BY created_at ASC");
    $images = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 내보낼 데이터 구성
    $exportData = array(
        'version' => '2.0', // 버전 업그레이드 (이미지 포함)
        'export_date' => date('Y-m-d H:i:s'),
        'export_type' => 'full', // full export with images
        'projects' => $projects,
        'project_images' => $images,
        'metadata' => array(
            'project_count' => count($projects),
            'image_count' => count($images)
        )
    );
    
    // JSON 파일 생성
    $json_file = $temp_dir . '/database.json';
    file_put_contents($json_file, json_encode($exportData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    
    // 메모리 정리
    unset($exportData, $projects, $images);
    
    // 2. ZIP 파일 생성 (대용량 파일 지원)
    $zip_filename = 'photo_classifier_full_backup_' . date('Y-m-d_His') . '.zip';
    $zip_path = $temp_dir . '/' . $zip_filename;
    
    $zip = new ZipArchive();
    if ($zip->open($zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        throw new Exception('Cannot create ZIP file');
    }
    
    // ZIP 압축 레벨 설정 (빠른 압축)
    $zip->setCompressionName('database.json', ZipArchive::CM_STORE); // 압축 안 함 (빠름)
    
    // JSON 파일 추가
    $zip->addFile($json_file, 'database.json');
    
    // 3. 이미지 파일들 추가 (압축 레벨 최소화로 속도 향상)
    $uploads_dir = '../uploads';
    $added_files = 0;
    $skipped_files = 0;
    $total_size = 0;
    
    // 프로젝트별로 이미지 정리
    if (is_dir($uploads_dir)) {
        $project_folders = glob($uploads_dir . '/project_*', GLOB_ONLYDIR);
        
        foreach ($project_folders as $project_path) {
            $project_folder = basename($project_path);
            
            // ZIP 내에 프로젝트 폴더 생성
            $zip->addEmptyDir('uploads/' . $project_folder);
            
            // 프로젝트 폴더 내 모든 파일 추가 (압축 최소화)
            $files = glob($project_path . '/*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    $relative_path = 'uploads/' . $project_folder . '/' . basename($file);
                    
                    // 이미지 파일은 압축하지 않음 (이미 압축된 포맷)
                    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                        $zip->setCompressionName($relative_path, ZipArchive::CM_STORE);
                    } else {
                        $zip->setCompressionName($relative_path, ZipArchive::CM_DEFLATE);
                    }
                    
                    $zip->addFile($file, $relative_path);
                    
                    $added_files++;
                    $total_size += filesize($file);
                    
                    // 메모리 관리 (50개 파일마다 플러시)
                    if ($added_files % 50 == 0) {
                        ob_flush();
                        flush();
                    }
                }
            }
        }
    }
    
    // 4. 내보내기 정보 파일 추가
    $info_content = "Photo Classifier Full Backup\n";
    $info_content .= "============================\n\n";
    $info_content .= "Export Date: " . date('Y-m-d H:i:s') . "\n";
    $info_content .= "Projects: " . count($project_folders ?? []) . "\n";
    $info_content .= "Image Files: " . $added_files . "\n";
    $info_content .= "Total Size: " . formatBytes($total_size) . "\n";
    $info_content .= "Skipped Files: " . $skipped_files . "\n\n";
    $info_content .= "To restore this backup:\n";
    $info_content .= "1. Extract this ZIP file\n";
    $info_content .= "2. Use 'Import Full Backup' feature in the application\n";
    $info_content .= "3. Select the extracted folder\n";
    
    $zip->addFromString('README.txt', $info_content);
    
    // ZIP 파일 닫기
    $zip->close();
    
    // 출력 버퍼 정리
    ob_end_clean();
    
    // 5. 파일 다운로드 (스트리밍 방식)
    if (file_exists($zip_path)) {
        $file_size = filesize($zip_path);
        
        // 헤더 설정
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $zip_filename . '"');
        header('Content-Length: ' . $file_size);
        header('Content-Transfer-Encoding: binary');
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // 대용량 파일 스트리밍 (청크 단위로 전송)
        $chunk_size = 8192; // 8KB 청크
        $handle = fopen($zip_path, 'rb');
        
        while (!feof($handle)) {
            echo fread($handle, $chunk_size);
            ob_flush();
            flush();
        }
        
        fclose($handle);
        
        // 임시 파일 정리
        @unlink($json_file);
        @unlink($zip_path);
        @rmdir($temp_dir);
        
        exit;
    } else {
        throw new Exception('Failed to create ZIP file');
    }
    
} catch(Exception $e) {
    // 오류 발생 시 임시 파일 정리
    if (isset($json_file) && file_exists($json_file)) @unlink($json_file);
    if (isset($zip_path) && file_exists($zip_path)) @unlink($zip_path);
    if (is_dir($temp_dir)) @rmdir($temp_dir);
    
    header('Content-Type: application/json');
    echo json_encode(array(
        'success' => false,
        'message' => 'Export failed: ' . $e->getMessage()
    ));
}

// 바이트를 읽기 쉬운 형식으로 변환
function formatBytes($bytes, $precision = 2) {
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}
?>