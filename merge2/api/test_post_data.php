<?php
// 에러 표시 설정
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';

try {
    echo "1. DB 연결 시도...<br>";
    $pdo = getDBConnection();
    echo "2. DB 연결 성공!<br>";
    
    // 현재 테이블 구조 확인
    echo "3. projects 테이블 구조 확인...<br>";
    $stmt = $pdo->query("DESCRIBE projects");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<pre>";
    print_r($columns);
    echo "</pre>";
    
    // post_data 컬럼 존재 여부 확인
    $hasPostData = false;
    foreach ($columns as $column) {
        if ($column['Field'] == 'post_data') {
            $hasPostData = true;
            break;
        }
    }
    
    if (!$hasPostData) {
        echo "4. post_data 컬럼이 없습니다. 추가 중...<br>";
        
        // 컬럼 추가
        $sql = "ALTER TABLE projects ADD COLUMN post_data TEXT DEFAULT NULL";
        $pdo->exec($sql);
        
        echo "5. post_data 컬럼 추가 완료!<br>";
    } else {
        echo "4. post_data 컬럼이 이미 존재합니다.<br>";
    }
    
    // 테스트 데이터 삽입
    echo "6. 테스트 프로젝트 생성 중...<br>";
    
    $testData = [
        'name' => 'test_post_' . time(),
        'categories' => json_encode([
            ['name' => '외부', 'defaultCount' => 5, 'enabled' => true],
            ['name' => '내부', 'defaultCount' => 6, 'enabled' => true]
        ]),
        'category_preview_counts' => json_encode(['외부' => 5, '내부' => 6]),
        'selected_images' => json_encode([]),
        'post_data' => json_encode([
            'storeName' => '테스트 매장',
            'storeInfo' => '테스트 정보'
        ]),
        'thumbnail_size' => 100,
        'category_counter' => 2
    ];
    
    $sql = "INSERT INTO projects (name, categories, category_preview_counts, selected_images, post_data, thumbnail_size, category_counter, created_at, updated_at) 
            VALUES (:name, :categories, :category_preview_counts, :selected_images, :post_data, :thumbnail_size, :category_counter, NOW(), NOW())";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($testData);
    
    echo "7. 테스트 프로젝트 생성 완료!<br>";
    
    // 저장된 데이터 확인
    echo "8. 저장된 데이터 확인...<br>";
    $stmt = $pdo->prepare("SELECT * FROM projects WHERE name = ?");
    $stmt->execute([$testData['name']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "<pre>";
    print_r($result);
    echo "</pre>";
    
    echo "<br><strong>✅ 모든 테스트 완료! post_data 기능이 정상 작동합니다.</strong>";
    
} catch (Exception $e) {
    echo "<br><strong>❌ 오류 발생:</strong> " . $e->getMessage();
    echo "<br>Stack trace:<pre>" . $e->getTraceAsString() . "</pre>";
}
?>