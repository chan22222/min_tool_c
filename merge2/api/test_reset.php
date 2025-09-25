<?php
// SQL 데이터 초기화 테스트
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔧 SQL 데이터 초기화 테스트</h1>";

try {
    echo "<h2>1. 설정 파일 로드</h2>";
    require_once 'config.php';
    echo "✅ config.php 로드 성공<br>";
    
    echo "<h2>2. 데이터베이스 연결</h2>";
    $pdo = getDBConnection();
    echo "✅ 데이터베이스 연결 성공<br>";
    
    echo "<h2>3. 트랜잭션 시작</h2>";
    $pdo->beginTransaction();
    echo "✅ 트랜잭션 시작 성공<br>";
    
    echo "<h2>4. 업로드 디렉토리 확인</h2>";
    $uploads_dir = '../uploads';
    echo "업로드 디렉토리: $uploads_dir<br>";
    echo "존재 여부: " . (is_dir($uploads_dir) ? "✅ 존재" : "❌ 존재하지 않음") . "<br>";
    
    if (is_dir($uploads_dir)) {
        $folders = glob($uploads_dir . '/*', GLOB_ONLYDIR);
        echo "발견된 폴더 수: " . count($folders) . "<br>";
        
        foreach ($folders as $folder) {
            echo "- " . basename($folder) . "<br>";
        }
    }
    
    echo "<h2>5. 테이블 데이터 확인</h2>";
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM projects");
    $project_count = $stmt->fetch()['count'];
    echo "프로젝트 수: $project_count<br>";
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM project_images");
    $image_count = $stmt->fetch()['count'];
    echo "이미지 레코드 수: $image_count<br>";
    
    echo "<h2>6. 데이터 삭제 테스트</h2>";
    
    // project_images 테이블 삭제
    $stmt = $pdo->exec("DELETE FROM project_images");
    echo "project_images 삭제된 레코드: $stmt<br>";
    
    // projects 테이블 삭제
    $stmt = $pdo->exec("DELETE FROM projects");
    echo "projects 삭제된 레코드: $stmt<br>";
    
    echo "<h2>7. 트랜잭션 커밋</h2>";
    $pdo->commit();
    echo "✅ 트랜잭션 커밋 성공<br>";
    
    echo "<h2>8. AUTO_INCREMENT 리셋 (트랜잭션 밖에서)</h2>";
    $pdo->exec("ALTER TABLE project_images AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE projects AUTO_INCREMENT = 1");
    echo "✅ AUTO_INCREMENT 리셋 완료<br>";
    
    echo "<h2>9. 결과 확인</h2>";
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM projects");
    $project_count = $stmt->fetch()['count'];
    echo "삭제 후 프로젝트 수: $project_count<br>";
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM project_images");
    $image_count = $stmt->fetch()['count'];
    echo "삭제 후 이미지 레코드 수: $image_count<br>";
    
    echo "<h2>✅ 모든 테스트 성공!</h2>";
    
} catch (Exception $e) {
    echo "<h2>❌ 오류 발생</h2>";
    echo "오류 메시지: " . $e->getMessage() . "<br>";
    echo "오류 파일: " . $e->getFile() . "<br>";
    echo "오류 라인: " . $e->getLine() . "<br>";
    echo "스택 트레이스:<br><pre>" . $e->getTraceAsString() . "</pre>";
    
    // 트랜잭션 롤백 시도
    if (isset($pdo) && $pdo->inTransaction()) {
        try {
            $pdo->rollBack();
            echo "✅ 트랜잭션 롤백 성공<br>";
        } catch (Exception $rollbackError) {
            echo "❌ 트랜잭션 롤백 실패: " . $rollbackError->getMessage() . "<br>";
        }
    }
}
?>
