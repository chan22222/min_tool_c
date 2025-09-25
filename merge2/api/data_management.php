<?php
// 프로덕션 버전 - 에러는 로그에만 기록
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

// 대용량 파일 처리를 위한 설정 (10GB+)
ini_set('memory_limit', '-1'); // 무제한
ini_set('max_execution_time', 0); // 무제한
set_time_limit(0); // 실행 시간 무제한

// 필수 파일 확인
if (!file_exists('config.php')) {
    die('config.php file not found');
}
if (!file_exists('project_hash.php')) {
    die('project_hash.php file not found');
}

require_once 'config.php';
require_once 'project_hash.php';

// 헤더 설정은 에러 출력 후에
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// sendResponse 함수가 없으면 여기서 정의
if (!function_exists('sendResponse')) {
    function sendResponse($success, $data = null, $message = '') {
        $response = array(
            'success' => $success,
            'data' => $data,
            'message' => $message
        );
        
        echo json_encode($response);
        exit();
    }
}

// handleError 함수가 없으면 여기서 정의
if (!function_exists('handleError')) {
    function handleError($message, $code = 500) {
        http_response_code($code);
        sendResponse(false, null, $message);
    }
}

// getProjectFolderName 함수가 없으면 여기서 정의
if (!function_exists('getProjectFolderName')) {
    function getProjectFolderName($projectName) {
        // project_hash.php에 정의되어 있어야 함
        return 'project_' . substr(md5($projectName), 0, 16);
    }
}

try {
    $pdo = getDBConnection();
} catch(Exception $e) {
    handleError('Database connection failed: ' . $e->getMessage());
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

// 액션 로깅 (디버깅용)
error_log("Data Management Action: " . $action . " Method: " . $_SERVER['REQUEST_METHOD']);

switch($action) {
    case 'export':
        exportData($pdo);
        break;
        
    case 'import':
        importData($pdo);
        break;
        
    case 'reset':
        resetData($pdo);
        break;
        
    default:
        handleError('Invalid action: ' . $action);
}
// 데이터 내보내기 함수
function exportData($pdo) {
    try {
        // projects 테이블 데이터 가져오기
        $stmt = $pdo->query("SELECT * FROM projects ORDER BY created_at ASC");
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // project_images 테이블 데이터 가져오기
        $stmt = $pdo->query("SELECT * FROM project_images ORDER BY created_at ASC");
        $images = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 내보낼 데이터 구성
        $exportData = array(
            'version' => '1.0',
            'export_date' => date('Y-m-d H:i:s'),
            'projects' => $projects,
            'project_images' => $images,
            'metadata' => array(
                'project_count' => count($projects),
                'image_count' => count($images)
            )
        );
        
        // JSON으로 인코딩
        $jsonData = json_encode($exportData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        
        // 파일 다운로드로 제공
        $filename = 'photo_classifier_backup_' . date('Y-m-d_His') . '.json';
        
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($jsonData));
        
        echo $jsonData;
        exit;
        
    } catch(Exception $e) {
        handleError('Export failed: ' . $e->getMessage());
    }
}

// 데이터 가져오기 함수
function importData($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['data'])) {
        handleError('No import data provided');
    }
    
    // JSON 문자열을 파싱
    $importData = is_string($input['data']) ? json_decode($input['data'], true) : $input['data'];
    
    if (!$importData || !isset($importData['projects']) || !isset($importData['project_images'])) {
        handleError('Invalid import data format');
    }
    
    try {
        // 트랜잭션 시작
        $pdo->beginTransaction();
        
        $imported_projects = 0;
        $imported_images = 0;
        $skipped_projects = 0;
        $skipped_images = 0;
        
        // projects 데이터 가져오기
        if (isset($importData['projects']) && is_array($importData['projects'])) {
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
                            isset($project['thumbnail_size']) ? $project['thumbnail_size'] : 100,
                            isset($project['category_counter']) ? $project['category_counter'] : 0,
                            $project['name']
                        ));
                        $skipped_projects++;
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
                            isset($project['thumbnail_size']) ? $project['thumbnail_size'] : 100,
                            isset($project['category_counter']) ? $project['category_counter'] : 0,
                            isset($project['created_at']) ? $project['created_at'] : date('Y-m-d H:i:s')
                        ));
                        $imported_projects++;
                        
                        // 프로젝트 폴더 생성
                        $safe_project_name = getProjectFolderName($project['name']);
                        $project_dir = '../uploads/' . $safe_project_name;
                        if (!is_dir($project_dir)) {
                            @mkdir($project_dir, 0755, true);
                        }
                    }
                } catch(Exception $e) {
                    error_log("Failed to import project: " . $e->getMessage());
                    continue;
                }
            }
        }        
        // project_images 데이터 가져오기
        if (isset($importData['project_images']) && is_array($importData['project_images'])) {
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
                            isset($image['file_size']) ? $image['file_size'] : 0,
                            isset($image['mime_type']) ? $image['mime_type'] : '',
                            $image['file_path'],
                            isset($image['created_at']) ? $image['created_at'] : date('Y-m-d H:i:s')
                        ));
                        $imported_images++;
                    } else {
                        $skipped_images++;
                    }
                } catch(Exception $e) {
                    error_log("Failed to import image: " . $e->getMessage());
                    continue;
                }
            }
        }
        
        // 트랜잭션 커밋
        $pdo->commit();
        
        sendResponse(true, array(
            'imported_projects' => $imported_projects,
            'imported_images' => $imported_images,
            'skipped_projects' => $skipped_projects,
            'skipped_images' => $skipped_images
        ), 'Data imported successfully');
        
    } catch(Exception $e) {
        // 트랜잭션 롤백
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        handleError('Import failed: ' . $e->getMessage());
    }
}

// 데이터 초기화 함수
function resetData($pdo) {
    try {
        error_log("=== RESET DATA START ===");
        error_log("Starting data reset...");
        
        // 데이터베이스 연결 상태 확인
        if (!$pdo) {
            error_log("Database connection is null");
            throw new Exception('Database connection is null');
        }
        
        // 트랜잭션 시작
        try {
            $pdo->beginTransaction();
            error_log("Transaction started successfully");
        } catch (Exception $e) {
            error_log("Failed to start transaction: " . $e->getMessage());
            throw $e;
        }
        
        // 모든 업로드된 파일 삭제
        $uploads_dir = '../uploads';
        $deleted_folders = 0;
        $deleted_files = 0;
        
        error_log("Checking uploads directory: " . $uploads_dir);
        
        if (is_dir($uploads_dir)) {
            $folders = glob($uploads_dir . '/*', GLOB_ONLYDIR);
            error_log("Found " . count($folders) . " folders in uploads directory");
            
            foreach ($folders as $folder) {
                // 프로젝트 폴더인지 확인 (project_로 시작)
                if (strpos(basename($folder), 'project_') === 0) {
                    error_log("Processing project folder: " . $folder);
                    
                    try {
                        // 폴더 내 파일 삭제 (간단한 방식)
                        $files = glob($folder . '/*');
                        foreach ($files as $file) {
                            if (is_file($file)) {
                                if (@unlink($file)) {
                                    $deleted_files++;
                                } else {
                                    error_log("Failed to delete file: " . $file);
                                }
                            }
                        }
                        
                        // 최상위 프로젝트 폴더 삭제
                        if (@rmdir($folder)) {
                            $deleted_folders++;
                            error_log("Deleted project folder: " . $folder);
                        } else {
                            error_log("Failed to delete project folder: " . $folder);
                        }
                    } catch (Exception $e) {
                        error_log("Error processing folder $folder: " . $e->getMessage());
                        // 폴더 처리 실패해도 계속 진행
                    }
                }
            }
        } else {
            error_log("Uploads directory does not exist: " . $uploads_dir);
        }
        
        error_log("Deleted $deleted_files files and $deleted_folders folders");
        
        // 테이블 데이터 삭제 (구조는 유지)
        try {
            error_log("Deleting project_images records...");
            $stmt = $pdo->exec("DELETE FROM project_images");
            error_log("Deleted project_images records: " . $stmt);
        } catch (Exception $e) {
            error_log("Failed to delete project_images: " . $e->getMessage());
            throw $e;
        }
        
        try {
            error_log("Deleting projects records...");
            $stmt = $pdo->exec("DELETE FROM projects");
            error_log("Deleted projects records: " . $stmt);
        } catch (Exception $e) {
            error_log("Failed to delete projects: " . $e->getMessage());
            throw $e;
        }
        
        // 트랜잭션 커밋
        try {
            $pdo->commit();
            error_log("Transaction committed successfully");
        } catch (Exception $e) {
            error_log("Failed to commit transaction: " . $e->getMessage());
            throw $e;
        }
        
        // AUTO_INCREMENT 리셋 (트랜잭션 밖에서 실행 - DDL은 암시적 커밋 발생)
        try {
            error_log("Resetting AUTO_INCREMENT...");
            $pdo->exec("ALTER TABLE project_images AUTO_INCREMENT = 1");
            $pdo->exec("ALTER TABLE projects AUTO_INCREMENT = 1");
            error_log("Reset AUTO_INCREMENT completed");
        } catch (Exception $e) {
            error_log("Failed to reset AUTO_INCREMENT: " . $e->getMessage());
            // AUTO_INCREMENT 리셋 실패는 치명적이지 않으므로 예외를 던지지 않음
        }
        
        error_log("=== RESET DATA SUCCESS ===");
        
        sendResponse(true, array(
            'message' => 'All data has been reset successfully',
            'deleted_files' => $deleted_files,
            'deleted_folders' => $deleted_folders
        ), 'Data reset successfully');
        
    } catch(Exception $e) {
        error_log("=== RESET DATA FAILED ===");
        error_log("Reset failed with exception: " . $e->getMessage());
        error_log("Exception trace: " . $e->getTraceAsString());
        
        // 트랜잭션 롤백
        if ($pdo && $pdo->inTransaction()) {
            try {
                $pdo->rollBack();
                error_log("Transaction rolled back successfully");
            } catch (Exception $rollbackError) {
                error_log("Rollback failed: " . $rollbackError->getMessage());
            }
        }
        
        handleError('Reset failed: ' . $e->getMessage());
    }
}
?>