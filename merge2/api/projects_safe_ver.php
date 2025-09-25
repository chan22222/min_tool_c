<?php
// 에러 표시 비활성화 (프로덕션)
error_reporting(0);
ini_set('display_errors', 0);

require_once 'config.php';
require_once 'project_hash.php';

header('Content-Type: application/json; charset=utf-8');

// post_data 컬럼 존재 여부를 확인하는 헬퍼 함수
function hasPostDataColumn($pdo) {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM projects LIKE 'post_data'");
        return $stmt->fetch() !== false;
    } catch (Exception $e) {
        return false;
    }
}

// post_data 컬럼 추가 시도
function ensurePostDataColumn($pdo) {
    if (!hasPostDataColumn($pdo)) {
        try {
            $pdo->exec("ALTER TABLE projects ADD COLUMN post_data TEXT DEFAULT NULL");
            return true;
        } catch (Exception $e) {
            // 무시 - 이미 있거나 권한 없음
            return false;
        }
    }
    return true;
}

try {
    $pdo = getDBConnection();
    
    // post_data 컬럼 확인 및 추가 시도
    $hasPostData = ensurePostDataColumn($pdo);
    
} catch(Exception $e) {
    handleError('Database connection failed: ' . $e->getMessage());
}

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        try {
            // post_data 컬럼 존재 여부에 따라 쿼리 조정
            if ($hasPostData) {
                $sql = "SELECT * FROM projects ORDER BY updated_at DESC";
            } else {
                $sql = "SELECT id, name, categories, category_preview_counts, selected_images, 
                       thumbnail_size, category_counter, created_at, updated_at 
                       FROM projects ORDER BY updated_at DESC";
            }
            
            $stmt = $pdo->query($sql);
            $projects = $stmt->fetchAll();
            
            // JSON 필드 디코딩
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
                if ($hasPostData && isset($project['post_data'])) {
                    $decoded = json_decode($project['post_data'], true);
                    $project['post_data'] = $decoded ? $decoded : null;
                }
                
                // 폴더명 계산
                $project['folder_name'] = getProjectFolderName($project['name']);
                
                // 이미지 통계
                $stmt2 = $pdo->prepare("SELECT COUNT(*) as image_count, COALESCE(SUM(file_size), 0) as total_size 
                                       FROM project_images WHERE project_name = ?");
                $stmt2->execute(array($project['name']));
                $stats = $stmt2->fetch();
                $project['image_count'] = $stats['image_count'];
                $project['total_size'] = $stats['total_size'];
            }
            
            sendResponse(true, $projects, 'Projects retrieved successfully');
        } catch(PDOException $e) {
            handleError('Failed to retrieve projects: ' . $e->getMessage());
        }
        break;
        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['name']) || empty(trim($input['name']))) {
            handleError('Project name is required', 400);
        }
        
        $projectName = trim($input['name']);
        
        try {
            $pdo->beginTransaction();
            
            // 기존 프로젝트 확인
            $stmt = $pdo->prepare("SELECT id, name FROM projects WHERE name = ?");
            $stmt->execute(array($projectName));
            $existingProject = $stmt->fetch();
            
            // JSON 인코딩
            $categories = '[]';
            if (isset($input['categories'])) {
                $categories = json_encode($input['categories'], JSON_UNESCAPED_UNICODE);
            }
            
            $categoryPreviewCounts = '{}';
            if (isset($input['category_preview_counts'])) {
                $categoryPreviewCounts = json_encode($input['category_preview_counts'], JSON_UNESCAPED_UNICODE);
            }
            
            $selectedImages = '[]';
            if (isset($input['selected_images'])) {
                $selectedImages = json_encode($input['selected_images'], JSON_UNESCAPED_UNICODE);
            }
            
            $thumbnailSize = isset($input['thumbnail_size']) ? intval($input['thumbnail_size']) : 100;
            $categoryCounter = isset($input['category_counter']) ? intval($input['category_counter']) : 0;
            
            // post_data 처리
            $postData = NULL;
            if (isset($input['post_data']) && !empty($input['post_data'])) {
                $postData = json_encode($input['post_data'], JSON_UNESCAPED_UNICODE);
            }
            
            if ($existingProject) {
                // UPDATE 쿼리 - post_data 컬럼 존재 여부에 따라 다르게 처리
                if ($hasPostData) {
                    $sql = "UPDATE projects SET 
                            categories = ?, 
                            category_preview_counts = ?, 
                            selected_images = ?, 
                            post_data = ?,
                            thumbnail_size = ?, 
                            category_counter = ?, 
                            updated_at = NOW() 
                            WHERE id = ?";
                    $params = array(
                        $categories,
                        $categoryPreviewCounts,
                        $selectedImages,
                        $postData,
                        $thumbnailSize,
                        $categoryCounter,
                        $existingProject['id']
                    );
                } else {
                    $sql = "UPDATE projects SET 
                            categories = ?, 
                            category_preview_counts = ?, 
                            selected_images = ?, 
                            thumbnail_size = ?, 
                            category_counter = ?, 
                            updated_at = NOW() 
                            WHERE id = ?";
                    $params = array(
                        $categories,
                        $categoryPreviewCounts,
                        $selectedImages,
                        $thumbnailSize,
                        $categoryCounter,
                        $existingProject['id']
                    );
                }
                
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute($params);
                
                if (!$result) {
                    throw new Exception('Failed to update project');
                }
                
                $project_id = $existingProject['id'];
                $action = 'updated';
            } else {
                // INSERT 쿼리 - post_data 컬럼 존재 여부에 따라 다르게 처리
                if ($hasPostData) {
                    $sql = "INSERT INTO projects 
                            (name, categories, category_preview_counts, selected_images, post_data, 
                             thumbnail_size, category_counter, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
                    $params = array(
                        $projectName,
                        $categories,
                        $categoryPreviewCounts,
                        $selectedImages,
                        $postData,
                        $thumbnailSize,
                        $categoryCounter
                    );
                } else {
                    $sql = "INSERT INTO projects 
                            (name, categories, category_preview_counts, selected_images, 
                             thumbnail_size, category_counter, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())";
                    $params = array(
                        $projectName,
                        $categories,
                        $categoryPreviewCounts,
                        $selectedImages,
                        $thumbnailSize,
                        $categoryCounter
                    );
                }
                
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute($params);
                
                if (!$result) {
                    throw new Exception('Failed to create project');
                }
                
                $project_id = $pdo->lastInsertId();
                $action = 'created';
            }
            
            $pdo->commit();
            
            $data = array(
                'project_id' => $project_id,
                'project_name' => $projectName,
                'action' => $action,
                'has_post_data' => $hasPostData
            );
            
            sendResponse(true, $data, "Project {$action} successfully");
            
        } catch(Exception $e) {
            $pdo->rollBack();
            handleError('Failed to save project: ' . $e->getMessage());
        }
        break;
        
    case 'DELETE':
        if (!isset($_GET['name'])) {
            handleError('Project name is required', 400);
        }
        
        $projectName = $_GET['name'];
        
        try {
            $pdo->beginTransaction();
            
            // 프로젝트 이미지 삭제
            $stmt = $pdo->prepare("DELETE FROM project_images WHERE project_name = ?");
            $stmt->execute(array($projectName));
            
            // 프로젝트 삭제
            $stmt = $pdo->prepare("DELETE FROM projects WHERE name = ?");
            $stmt->execute(array($projectName));
            
            $pdo->commit();
            
            sendResponse(true, null, 'Project deleted successfully');
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            handleError('Failed to delete project: ' . $e->getMessage());
        }
        break;
        
    default:
        handleError('Method not allowed', 405);
}
?>