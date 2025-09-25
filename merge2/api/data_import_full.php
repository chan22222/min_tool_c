<?php
// JSON 응답이 깨지지 않도록 에러 출력 비활성화
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);

// 대용량 파일 처리를 위한 설정 (10GB+)
ini_set('memory_limit', '-1'); // 무제한
ini_set('max_execution_time', 0); // 무제한
ini_set('post_max_size', '12G'); // 12GB
ini_set('upload_max_filesize', '12G'); // 12GB
set_time_limit(0); // 실행 시간 무제한

require_once 'config.php';
require_once 'project_hash.php';

header('Content-Type: application/json; charset=utf-8');

// CORS 헤더
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// POST 요청만 허용
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    handleError('Method not allowed', 405);
}

// ZIP 확장 확인
if (!class_exists('ZipArchive')) {
    handleError('ZIP extension is not installed on this server');
}

try {
    $pdo = getDBConnection();
} catch(Exception $e) {
    handleError('Database connection failed: ' . $e->getMessage());
}

// 파일 업로드 확인
if (!isset($_FILES['backup']) || $_FILES['backup']['error'] !== UPLOAD_ERR_OK) {
    $upload_errors = array(
        UPLOAD_ERR_INI_SIZE => 'The uploaded file exceeds the upload_max_filesize directive in php.ini',
        UPLOAD_ERR_FORM_SIZE => 'The uploaded file exceeds the MAX_FILE_SIZE directive',
        UPLOAD_ERR_PARTIAL => 'The uploaded file was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
    );
    
    $error_code = isset($_FILES['backup']) ? $_FILES['backup']['error'] : UPLOAD_ERR_NO_FILE;
    $error_message = isset($upload_errors[$error_code]) ? $upload_errors[$error_code] : 'Unknown upload error';
    
    handleError('File upload failed: ' . $error_message);
}

$uploaded_file = $_FILES['backup']['tmp_name'];
$file_name = $_FILES['backup']['name'];
$file_size = $_FILES['backup']['size'];

// 파일 크기 로깅 (디버깅용)
error_log("Importing backup file: $file_name (Size: " . formatBytes($file_size) . ")");

// ZIP 파일 확인
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime_type = finfo_file($finfo, $uploaded_file);
finfo_close($finfo);

if ($mime_type !== 'application/zip' && $mime_type !== 'application/x-zip-compressed' && $mime_type !== 'application/octet-stream') {
    handleError('Uploaded file is not a valid ZIP file (MIME: ' . $mime_type . ')');
}

// 임시 추출 디렉토리 생성
$temp_dir = sys_get_temp_dir() . '/photo_classifier_import_' . uniqid();
if (!mkdir($temp_dir, 0777, true)) {
    handleError('Failed to create temporary directory');
}

try {
    // ZIP 파일 추출 (대용량 파일 지원)
    $zip = new ZipArchive();
    $result = $zip->open($uploaded_file);
    
    if ($result !== TRUE) {
        $zip_errors = array(
            ZipArchive::ER_OK => 'No error',
            ZipArchive::ER_MULTIDISK => 'Multi-disk zip archives not supported',
            ZipArchive::ER_RENAME => 'Renaming temporary file failed',
            ZipArchive::ER_CLOSE => 'Closing zip archive failed',
            ZipArchive::ER_SEEK => 'Seek error',
            ZipArchive::ER_READ => 'Read error',
            ZipArchive::ER_WRITE => 'Write error',
            ZipArchive::ER_CRC => 'CRC error',
            ZipArchive::ER_ZIPCLOSED => 'Containing zip archive was closed',
            ZipArchive::ER_NOENT => 'No such file',
            ZipArchive::ER_EXISTS => 'File already exists',
            ZipArchive::ER_OPEN => 'Cannot open file',
            ZipArchive::ER_TMPOPEN => 'Failure to create temporary file',
            ZipArchive::ER_ZLIB => 'Zlib error',
            ZipArchive::ER_MEMORY => 'Memory allocation failure',
            ZipArchive::ER_CHANGED => 'Entry has been changed',
            ZipArchive::ER_COMPNOTSUPP => 'Compression method not supported',
            ZipArchive::ER_EOF => 'Premature EOF',
            ZipArchive::ER_INVAL => 'Invalid argument',
            ZipArchive::ER_NOZIP => 'Not a zip archive',
            ZipArchive::ER_INTERNAL => 'Internal error',
            ZipArchive::ER_INCONS => 'Zip archive inconsistent'
        );
        
        $error_message = isset($zip_errors[$result]) ? $zip_errors[$result] : 'Unknown error';
        throw new Exception('Cannot open ZIP file: ' . $error_message);
    }    
    // ZIP 파일 추출
    $zip->extractTo($temp_dir);
    $zip->close();
    
    // database.json 파일 확인
    $json_file = $temp_dir . '/database.json';
    if (!file_exists($json_file)) {
        throw new Exception('database.json not found in backup file');
    }
    
    // JSON 데이터 읽기
    $json_content = file_get_contents($json_file);
    $importData = json_decode($json_content, true);
    
    if (!$importData || !isset($importData['projects']) || !isset($importData['project_images'])) {
        throw new Exception('Invalid backup data format');
    }
    
    // 트랜잭션 시작
    $pdo->beginTransaction();
    
    $imported_projects = 0;
    $imported_images = 0;
    $updated_projects = 0;
    $copied_files = 0;
    $failed_files = 0;
    
    // 1. Projects 데이터 가져오기
    foreach ($importData['projects'] as $project) {
        try {
            // 중복 확인
            $stmt = $pdo->prepare("SELECT id FROM projects WHERE name = ?");
            $stmt->execute(array($project['name']));
            $existing = $stmt->fetch();
            
            if ($existing) {
                // 기존 프로젝트 업데이트
                $sql = "UPDATE projects SET 
                        categories = ?, 
                        category_preview_counts = ?, 
                        selected_images = ?, 
                        thumbnail_size = ?, 
                        category_counter = ?, 
                        updated_at = NOW()
                        WHERE name = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(array(
                    $project['categories'],
                    $project['category_preview_counts'],
                    $project['selected_images'],
                    $project['thumbnail_size'],
                    $project['category_counter'],
                    $project['name']
                ));
                $updated_projects++;
            } else {
                // 새 프로젝트 추가
                $sql = "INSERT INTO projects 
                        (name, categories, category_preview_counts, selected_images, 
                         thumbnail_size, category_counter, created_at, updated_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(array(
                    $project['name'],
                    $project['categories'],
                    $project['category_preview_counts'],
                    $project['selected_images'],
                    $project['thumbnail_size'],
                    $project['category_counter'],
                    $project['created_at']
                ));
                $imported_projects++;
            }
            
            // 프로젝트 폴더 생성
            $safe_project_name = getProjectFolderName($project['name']);
            $project_dir = '../uploads/' . $safe_project_name;
            if (!is_dir($project_dir)) {
                @mkdir($project_dir, 0755, true);
            }
        } catch(Exception $e) {
            error_log("Failed to import project: " . $project['name'] . " - " . $e->getMessage());
            continue;
        }
    }    
    // 2. 이미지 파일 복사 (대용량 파일 지원)
    $uploads_source = $temp_dir . '/uploads';
    $uploads_dest = '../uploads';
    
    if (is_dir($uploads_source)) {
        // 각 프로젝트 폴더 처리
        $project_folders = glob($uploads_source . '/*', GLOB_ONLYDIR);
        foreach ($project_folders as $source_folder) {
            $folder_name = basename($source_folder);
            $dest_folder = $uploads_dest . '/' . $folder_name;
            
            // 대상 폴더 생성
            if (!is_dir($dest_folder)) {
                @mkdir($dest_folder, 0755, true);
            }
            
            // 폴더 내 파일들 복사
            $files = glob($source_folder . '/*');
            foreach ($files as $source_file) {
                if (is_file($source_file)) {
                    $dest_file = $dest_folder . '/' . basename($source_file);
                    
                    // 파일이 이미 존재하면 건너뛰기
                    if (file_exists($dest_file)) {
                        continue;
                    }
                    
                    // 대용량 파일 복사 (스트림 사용)
                    if (copyLargeFile($source_file, $dest_file)) {
                        $copied_files++;
                    } else {
                        $failed_files++;
                        error_log("Failed to copy file: " . basename($source_file));
                    }
                }
            }
        }
    }
    
    // 3. Project Images 메타데이터 가져오기
    foreach ($importData['project_images'] as $image) {
        try {
            // 중복 확인
            $stmt = $pdo->prepare("SELECT id FROM project_images WHERE project_name = ? AND stored_filename = ?");
            $stmt->execute(array($image['project_name'], $image['stored_filename']));
            $existing = $stmt->fetch();
            
            if (!$existing) {
                $sql = "INSERT INTO project_images 
                        (project_name, category_name, original_filename, stored_filename, 
                         file_size, mime_type, file_path, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(array(
                    $image['project_name'],
                    $image['category_name'],
                    $image['original_filename'],
                    $image['stored_filename'],
                    $image['file_size'],
                    $image['mime_type'],
                    $image['file_path'],
                    $image['created_at']
                ));
                $imported_images++;
            }
        } catch(Exception $e) {
            error_log("Failed to import image metadata: " . $image['stored_filename'] . " - " . $e->getMessage());
            continue;
        }
    }
    
    // 트랜잭션 커밋
    $pdo->commit();
    
    // 임시 디렉토리 정리
    deleteDirectory($temp_dir);
    
    // 성공 응답
    sendResponse(true, array(
        'imported_projects' => $imported_projects,
        'updated_projects' => $updated_projects,
        'imported_images' => $imported_images,
        'copied_files' => $copied_files,
        'failed_files' => $failed_files,
        'message' => 'Full backup imported successfully'
    ), 'Import completed');
    
} catch(Exception $e) {
    // 트랜잭션 롤백
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    // 임시 디렉토리 정리
    if (is_dir($temp_dir)) {
        deleteDirectory($temp_dir);
    }
    
    handleError('Import failed: ' . $e->getMessage());
}

// 대용량 파일 복사 함수 (스트림 사용)
function copyLargeFile($source, $dest) {
    $buffer_size = 1048576; // 1MB 버퍼
    
    $source_handle = @fopen($source, 'rb');
    if (!$source_handle) {
        return false;
    }
    
    $dest_handle = @fopen($dest, 'wb');
    if (!$dest_handle) {
        fclose($source_handle);
        return false;
    }
    
    while (!feof($source_handle)) {
        $buffer = fread($source_handle, $buffer_size);
        fwrite($dest_handle, $buffer);
    }
    
    fclose($source_handle);
    fclose($dest_handle);
    
    return true;
}

// 디렉토리 재귀적 삭제 함수
function deleteDirectory($dir) {
    if (!is_dir($dir)) {
        return;
    }
    
    $files = array_diff(scandir($dir), array('.', '..'));
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        if (is_dir($path)) {
            deleteDirectory($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
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