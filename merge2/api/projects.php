<?php
// 디버깅을 위해 에러 출력 활성화
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/projects_error_log.txt');

require_once 'config.php';
require_once 'project_hash.php';

// 요청 로그 기록 (디버깅용)
$log_file = __DIR__ . '/projects_log.txt';
$log_entry = date('Y-m-d H:i:s') . ' - ' . $_SERVER['REQUEST_METHOD'] . ' - ';

// 디버깅을 위한 추가 로그
file_put_contents($log_file, $log_entry . 'Script started' . PHP_EOL, FILE_APPEND);

try {
    file_put_contents($log_file, $log_entry . 'Attempting DB connection' . PHP_EOL, FILE_APPEND);
    $pdo = getDBConnection();
    file_put_contents($log_file, $log_entry . 'DB connection successful' . PHP_EOL, FILE_APPEND);
} catch(Exception $e) {
    file_put_contents($log_file, $log_entry . 'DB Connection Failed: ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
    handleError('Database connection failed: ' . $e->getMessage());
}

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        try {
            // 간단한 쿼리로 시작
            $sql = "SELECT * FROM projects ORDER BY updated_at DESC";
            $stmt = $pdo->query($sql);
            $projects = $stmt->fetchAll();
            
            file_put_contents($log_file, $log_entry . 'GET - Found ' . count($projects) . ' projects' . PHP_EOL, FILE_APPEND);
            
            // JSON 필드 디코딩 및 폴더명 추가
            foreach ($projects as &$project) {
                if (isset($project['categories'])) {
                    $decoded = json_decode($project['categories'], true);
                    $project['categories'] = $decoded ? $decoded : array();
                }
                if (isset($project['category_preview_counts'])) {
                    $decoded = json_decode($project['category_preview_counts'], true);
                    $project['category_preview_counts'] = $decoded ? $decoded : array();
                }
                if (isset($project['selected_images'])) {
                    $decoded = json_decode($project['selected_images'], true);
                    $project['selected_images'] = $decoded ? $decoded : array();
                }
                if (isset($project['post_data'])) {
                    $decoded = json_decode($project['post_data'], true);
                    $project['post_data'] = $decoded ? $decoded : null;
                }
                // 실제 폴더명 계산
                $project['folder_name'] = getProjectFolderName($project['name']);
                
                // 이미지 개수와 총 크기 계산
                $stmt2 = $pdo->prepare("SELECT COUNT(*) as image_count, COALESCE(SUM(file_size), 0) as total_size FROM project_images WHERE project_name = ?");
                $stmt2->execute(array($project['name']));
                $stats = $stmt2->fetch();
                $project['image_count'] = $stats['image_count'];
                $project['total_size'] = $stats['total_size'];
            }
            
            sendResponse(true, $projects, 'Projects retrieved successfully');
        } catch(PDOException $e) {
            file_put_contents($log_file, $log_entry . 'GET Failed: ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
            handleError('Failed to retrieve projects: ' . $e->getMessage());
        }
        break;        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        
        file_put_contents($log_file, $log_entry . 'POST - Input: ' . json_encode($input) . PHP_EOL, FILE_APPEND);
        
        if (!isset($input['name']) || empty(trim($input['name']))) {
            file_put_contents($log_file, $log_entry . 'POST Failed: Empty name' . PHP_EOL, FILE_APPEND);
            handleError('Project name is required', 400);
        }
        
        $projectName = trim($input['name']);
        
        // 프로젝트명 유효성 검사 (특수문자 제거)
        if (preg_match('/[<>:"\/\\|?*]/', $projectName)) {
            file_put_contents($log_file, $log_entry . 'POST Failed: Invalid characters in name' . PHP_EOL, FILE_APPEND);
            handleError('프로젝트명에 특수문자를 사용할 수 없습니다', 400);
        }
        
        try {
            // 트랜잭션 시작
            $pdo->beginTransaction();
            
            // 기존 프로젝트 확인
            $stmt = $pdo->prepare("SELECT id, name FROM projects WHERE name = ?");
            $stmt->execute(array($projectName));
            $existingProject = $stmt->fetch();
            
            // JSON 인코딩 (안전한 방식)
            $categories = '[]';
            if (isset($input['categories']) && !empty($input['categories'])) {
                $categories = json_encode($input['categories'], JSON_UNESCAPED_UNICODE);
            }
            
            $categoryPreviewCounts = '{}';
            if (isset($input['category_preview_counts']) && !empty($input['category_preview_counts'])) {
                $categoryPreviewCounts = json_encode($input['category_preview_counts'], JSON_UNESCAPED_UNICODE);
            }
            
            $selectedImages = '[]';
            if (isset($input['selected_images']) && !empty($input['selected_images'])) {
                $selectedImages = json_encode($input['selected_images'], JSON_UNESCAPED_UNICODE);
            }
            
            // post_data 처리 - NULL 허용
            $postData = NULL;
            if (isset($input['post_data']) && !empty($input['post_data'])) {
                $postData = json_encode($input['post_data'], JSON_UNESCAPED_UNICODE);
            }
            
            $thumbnailSize = isset($input['thumbnail_size']) ? intval($input['thumbnail_size']) : 100;
            $categoryCounter = isset($input['category_counter']) ? intval($input['category_counter']) : 0;
            
            if ($existingProject) {
                // 업데이트
                file_put_contents($log_file, $log_entry . "POST - Updating existing project: {$projectName} (ID: {$existingProject['id']})" . PHP_EOL, FILE_APPEND);
                
                $sql = "UPDATE projects SET 
                        categories = ?, 
                        category_preview_counts = ?, 
                        selected_images = ?, 
                        post_data = ?,
                        thumbnail_size = ?, 
                        category_counter = ?, 
                        updated_at = NOW() 
                        WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute(array(
                    $categories,
                    $categoryPreviewCounts,
                    $selectedImages,
                    $postData,
                    $thumbnailSize,
                    $categoryCounter,
                    $existingProject['id']
                ));
                
                if (!$result) {
                    throw new Exception('Failed to update project: ' . implode(', ', $stmt->errorInfo()));
                }
                
                $project_id = $existingProject['id'];
                $action = 'updated';
            } else {                // 새로 생성
                file_put_contents($log_file, $log_entry . "POST - Creating new project: {$projectName}" . PHP_EOL, FILE_APPEND);
                
                $sql = "INSERT INTO projects 
                        (name, categories, category_preview_counts, selected_images, post_data, thumbnail_size, category_counter, created_at, updated_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute(array(
                    $projectName,
                    $categories,
                    $categoryPreviewCounts,
                    $selectedImages,
                    $postData,
                    $thumbnailSize,
                    $categoryCounter
                ));
                
                if (!$result) {
                    throw new Exception('Failed to insert project: ' . implode(', ', $stmt->errorInfo()));
                }
                
                $project_id = $pdo->lastInsertId();
                $action = 'created';
                
                // 프로젝트 폴더 생성
                $safe_project_name = getProjectFolderName($projectName);
                $project_dir = '../uploads/' . $safe_project_name;
                if (!is_dir($project_dir)) {
                    if (!@mkdir($project_dir, 0755, true)) {
                        file_put_contents($log_file, $log_entry . "POST - Failed to create directory: {$project_dir}" . PHP_EOL, FILE_APPEND);
                    }
                }
            }
            
            // 트랜잭션 커밋
            $pdo->commit();
            
            // 생성/업데이트된 프로젝트 반환
            $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
            $stmt->execute(array($project_id));
            $project = $stmt->fetch();
            
            // JSON 디코딩 및 폴더명 추가
            if ($project) {
                $project['categories'] = json_decode($project['categories'], true);
                $project['category_preview_counts'] = json_decode($project['category_preview_counts'], true);
                $project['selected_images'] = json_decode($project['selected_images'], true);
                
                // 폴더명 계산
                $project['folder_name'] = getProjectFolderName($project['name']);
                $project['folder_name'] = 'project_' . substr(md5($project['name']), 0, 16);
                
                // 이미지 통계 추가
                $stmt2 = $pdo->prepare("SELECT COUNT(*) as image_count, COALESCE(SUM(file_size), 0) as total_size FROM project_images WHERE project_name = ?");
                $stmt2->execute(array($project['name']));
                $stats = $stmt2->fetch();
                $project['image_count'] = $stats['image_count'];
                $project['total_size'] = $stats['total_size'];
            }
            
            file_put_contents($log_file, $log_entry . "POST Success - Project {$action}: {$projectName} (ID: {$project_id})" . PHP_EOL, FILE_APPEND);
            
            sendResponse(true, $project, "Project {$action} successfully");
        } catch(Exception $e) {
            // 트랜잭션 롤백
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            
            file_put_contents($log_file, $log_entry . 'POST Failed: ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
            handleError('Failed to save project: ' . $e->getMessage());
        }
        break;        
    case 'DELETE':
        $project_name = isset($_GET['name']) ? $_GET['name'] : null;
        
        file_put_contents($log_file, $log_entry . "DELETE - Project: {$project_name}" . PHP_EOL, FILE_APPEND);
        
        if (!$project_name) {
            file_put_contents($log_file, $log_entry . 'DELETE Failed: No name provided' . PHP_EOL, FILE_APPEND);
            handleError('Project name is required', 400);
        }
        
        try {
            // 트랜잭션 시작
            $pdo->beginTransaction();
            
            // 프로젝트 확인
            $stmt = $pdo->prepare("SELECT * FROM projects WHERE name = ?");
            $stmt->execute(array($project_name));
            $project = $stmt->fetch();
            
            if (!$project) {
                file_put_contents($log_file, $log_entry . "DELETE Failed: Project not found - {$project_name}" . PHP_EOL, FILE_APPEND);
                handleError('Project not found', 404);
            }
            
            // 관련 이미지 및 폴더 삭제
            $stmt = $pdo->prepare("SELECT file_path FROM project_images WHERE project_name = ?");
            $stmt->execute(array($project_name));
            $images = $stmt->fetchAll();
            
            // 파일 삭제
            $deleted_files = 0;
            foreach ($images as $image) {
                $file_path = '../uploads/' . $image['file_path'];
                if (file_exists($file_path)) {
                    if (@unlink($file_path)) {
                        $deleted_files++;
                    }
                }
            }
            
            // 프로젝트 폴더 삭제
            $safe_project_name = getProjectFolderName($project_name);
            $project_dir = '../uploads/' . $safe_project_name;
            if (is_dir($project_dir)) {
                // 폴더 내 남은 파일 모두 삭제
                $files = glob($project_dir . '/*');
                foreach ($files as $file) {
                    if (is_file($file)) {
                        @unlink($file);
                    }
                }
                // 폴더 삭제
                if (!@rmdir($project_dir)) {
                    file_put_contents($log_file, $log_entry . "DELETE Warning: Could not remove directory - {$project_dir}" . PHP_EOL, FILE_APPEND);
                }
            }
            
            // 데이터베이스에서 이미지 삭제
            $stmt = $pdo->prepare("DELETE FROM project_images WHERE project_name = ?");
            $stmt->execute(array($project_name));
            $deleted_images = $stmt->rowCount();
            
            // 프로젝트 삭제
            $stmt = $pdo->prepare("DELETE FROM projects WHERE name = ?");
            $stmt->execute(array($project_name));
            
            // 트랜잭션 커밋
            $pdo->commit();
            
            file_put_contents($log_file, $log_entry . "DELETE Success - Project: {$project_name}, Images: {$deleted_images}, Files: {$deleted_files}" . PHP_EOL, FILE_APPEND);
            
            sendResponse(true, array(
                'deleted_project' => $project_name,
                'deleted_images' => $deleted_images,
                'deleted_files' => $deleted_files
            ), 'Project deleted successfully');
        } catch(Exception $e) {
            // 트랜잭션 롤백
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            
            file_put_contents($log_file, $log_entry . 'DELETE Failed: ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
            handleError('Failed to delete project: ' . $e->getMessage());
        }
        break;
        
    default:
        file_put_contents($log_file, $log_entry . 'Method not allowed: ' . $method . PHP_EOL, FILE_APPEND);
        handleError('Method not allowed', 405);
}
?>