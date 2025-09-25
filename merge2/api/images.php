<?php
// JSON 응답이 깨지지 않도록 에러 출력 비활성화
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);

require_once 'config.php';
require_once 'project_hash.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDBConnection();
    
    switch ($method) {
        case 'GET':
            // 특정 프로젝트의 이미지 목록 조회
            $project_name = isset($_GET['project']) ? $_GET['project'] : '';
            
            if (!$project_name) {
                handleError('Project name is required', 400);
            }
            
            $stmt = $pdo->prepare("
                SELECT * FROM project_images 
                WHERE project_name = ? 
                ORDER BY category_name, created_at
            ");
            $stmt->execute(array($project_name));
            $images = $stmt->fetchAll();
            
            // 카테고리별로 그룹화
            $grouped = array();
            foreach ($images as $image) {
                $category = $image['category_name'];
                if (!isset($grouped[$category])) {
                    $grouped[$category] = array();
                }
                
                // 파일 URL 생성 (URL 인코딩 처리)
                $path_parts = explode('/', $image['file_path']);
                $encoded_parts = array_map('rawurlencode', $path_parts);
                $image['url'] = '/merge2/uploads/' . implode('/', $encoded_parts);
                $image['direct_url'] = UPLOAD_URL . implode('/', $encoded_parts);
                $grouped[$category][] = $image;
            }
            
            sendResponse(true, $grouped);
            break;            
        case 'POST':
            // 이미지 업로드
            $project_name = isset($_POST['project']) ? $_POST['project'] : '';
            $category_name = isset($_POST['category']) ? $_POST['category'] : '';
            
            if (!$project_name || !$category_name) {
                handleError('Project and category names are required', 400);
            }
            
            if (!isset($_FILES['images'])) {
                handleError('No images to upload', 400);
            }
            
            $uploaded_files = array();
            $files = $_FILES['images'];
            
            // 다중 파일 처리
            if (is_array($files['name'])) {
                $file_count = count($files['name']);
                for ($i = 0; $i < $file_count; $i++) {
                    if ($files['error'][$i] === UPLOAD_ERR_OK) {
                        $file = array(
                            'name' => $files['name'][$i],
                            'type' => $files['type'][$i],
                            'tmp_name' => $files['tmp_name'][$i],
                            'error' => $files['error'][$i],
                            'size' => $files['size'][$i]
                        );
                        $result = uploadSingleFile($pdo, $project_name, $category_name, $file);
                        if ($result) {
                            $uploaded_files[] = $result;
                        }
                    }
                }
            } else {
                if ($files['error'] === UPLOAD_ERR_OK) {
                    $result = uploadSingleFile($pdo, $project_name, $category_name, $files);
                    if ($result) {
                        $uploaded_files[] = $result;
                    }
                }
            }
            
            $message = count($uploaded_files) . ' files uploaded successfully';
            sendResponse(true, $uploaded_files, $message);
            break;            
        case 'DELETE':
            // 이미지 삭제 - 개별 또는 카테고리별
            $image_id = isset($_GET['id']) ? $_GET['id'] : '';
            $project_name = isset($_GET['project']) ? $_GET['project'] : '';
            $category_name = isset($_GET['category']) ? $_GET['category'] : '';
            
            if ($image_id) {
                // 개별 이미지 삭제
                $stmt = $pdo->prepare("SELECT file_path FROM project_images WHERE id = ?");
                $stmt->execute(array($image_id));
                $image = $stmt->fetch();
                
                if (!$image) {
                    handleError('Image not found', 404);
                }
                
                // 파일 삭제
                $file_path = UPLOAD_DIR . $image['file_path'];
                if (file_exists($file_path)) {
                    @unlink($file_path);
                }
                
                // 데이터베이스에서 삭제
                $stmt = $pdo->prepare("DELETE FROM project_images WHERE id = ?");
                $stmt->execute(array($image_id));
                
                sendResponse(true, null, 'Image deleted successfully');
            } 
            else if ($project_name && $category_name) {
                // 카테고리별 이미지 삭제
                $stmt = $pdo->prepare("SELECT file_path FROM project_images WHERE project_name = ? AND category_name = ?");
                $stmt->execute(array($project_name, $category_name));
                $images = $stmt->fetchAll();
                
                $deleted_count = 0;
                foreach ($images as $image) {
                    $file_path = UPLOAD_DIR . $image['file_path'];
                    if (file_exists($file_path)) {
                        @unlink($file_path);
                        $deleted_count++;
                    }
                }
                
                // 데이터베이스에서 삭제
                $stmt = $pdo->prepare("DELETE FROM project_images WHERE project_name = ? AND category_name = ?");
                $stmt->execute(array($project_name, $category_name));
                
                sendResponse(true, array('deleted_count' => $deleted_count), 'Category images deleted successfully');
            }
            else {
                handleError('Image ID or Project/Category names are required', 400);
            }
            break;
            
        default:
            handleError('Method not supported', 405);
    }
    
} catch (Exception $e) {
    handleError('Server error: ' . $e->getMessage());
}

// 단일 파일 업로드 함수
function uploadSingleFile($pdo, $project_name, $category_name, $file) {
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return false;
    }
    
    if ($file['size'] > MAX_FILE_SIZE) {
        return false;
    }
    
    // MIME 타입 검증
    $allowed_types = array('image/jpeg', 'image/png', 'image/gif', 'image/webp');
    if (!in_array($file['type'], $allowed_types)) {
        return false;
    }
    
    // 파일명 생성
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $stored_filename = uniqid() . '_' . time() . '.' . $extension;
    
    // 프로젝트 폴더명을 생성
    $safe_project_name = getProjectFolderName($project_name);
    
    // 프로젝트별 디렉토리 생성
    $project_dir = UPLOAD_DIR . $safe_project_name . '/';
    if (!file_exists($project_dir)) {
        @mkdir($project_dir, 0755, true);
        // 디렉토리에 .htaccess 생성
        $htaccess = 'Options -Indexes
Order allow,deny
Allow from all';
        @file_put_contents($project_dir . '.htaccess', $htaccess);
    }
    
    $file_path = $safe_project_name . '/' . $stored_filename;
    $full_path = UPLOAD_DIR . $file_path;
    
    // 파일 이동
    if (move_uploaded_file($file['tmp_name'], $full_path)) {
        // 데이터베이스에 저장
        $stmt = $pdo->prepare("
            INSERT INTO project_images 
            (project_name, category_name, original_filename, stored_filename, file_size, mime_type, file_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute(array(
            $project_name,
            $category_name,
            $file['name'],
            $stored_filename,
            $file['size'],
            $file['type'],
            $file_path
        ));
        
        return array(
            'id' => $pdo->lastInsertId(),
            'original_filename' => $file['name'],
            'stored_filename' => $stored_filename,
            'file_path' => $file_path,
            'url' => '/uploads/' . $file_path,
            'size' => $file['size']
        );
    }
    
    return false;
}
?>