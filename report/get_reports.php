<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$exportDir = __DIR__ . '/export';
$files = [];

if (is_dir($exportDir)) {
    $items = scandir($exportDir);
    
    foreach ($items as $item) {
        if ($item != '.' && $item != '..' && pathinfo($item, PATHINFO_EXTENSION) == 'html') {
            $filePath = $exportDir . '/' . $item;
            $files[] = [
                'name' => $item,
                'url' => 'export/' . $item,
                'size' => filesize($filePath),
                'modified' => filemtime($filePath),
                'modified_date' => date('Y-m-d H:i:s', filemtime($filePath))
            ];
        }
    }
    
    // 수정일 기준 내림차순 정렬 (최신 파일이 위로)
    usort($files, function($a, $b) {
        return $b['modified'] - $a['modified'];
    });
}

echo json_encode([
    'success' => true,
    'files' => $files,
    'count' => count($files)
], JSON_UNESCAPED_UNICODE);
?>