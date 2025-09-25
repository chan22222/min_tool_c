<?php
// 프로젝트 API 간단 테스트
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    require_once 'config.php';
    require_once 'project_hash.php';
    
    $pdo = getDBConnection();
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        // 간단한 프로젝트 목록 조회
        $stmt = $pdo->query("SELECT id, name, created_at FROM projects ORDER BY created_at DESC");
        $projects = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'data' => $projects,
            'message' => 'Projects retrieved successfully',
            'count' => count($projects)
        ]);
        
    } elseif ($method === 'POST') {
        // 간단한 프로젝트 생성
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['name']) || empty(trim($input['name']))) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Project name is required'
            ]);
            exit;
        }
        
        $projectName = trim($input['name']);
        
        // 프로젝트 생성
        $sql = "INSERT INTO projects (name, categories, category_preview_counts, selected_images, thumbnail_size, category_counter) 
                VALUES (?, '[]', '{}', '[]', 100, 0)";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([$projectName]);
        
        if ($result) {
            $project_id = $pdo->lastInsertId();
            
            // 생성된 프로젝트 조회
            $stmt = $pdo->prepare("SELECT id, name, created_at FROM projects WHERE id = ?");
            $stmt->execute([$project_id]);
            $project = $stmt->fetch();
            
            echo json_encode([
                'success' => true,
                'data' => $project,
                'message' => 'Project created successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create project'
            ]);
        }
        
    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
?>
