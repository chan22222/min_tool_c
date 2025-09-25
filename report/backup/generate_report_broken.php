<?php
header('Content-Type: text/html; charset=utf-8');

// POST 데이터 받기
$clientName = $_POST['clientName'] ?? '';
$reportDate = $_POST['reportDate'] ?? date('Y-m-d');
$keywordData = $_POST['keywordData'] ?? '';

if (empty($clientName) || empty($keywordData)) {
    die('고객사명과 키워드 데이터를 입력해주세요.');
}

// 키워드 데이터 파싱
function parseKeywordData($rawData) {
    $lines = array_filter(explode("\n", trim($rawData)), function($line) {
        return trim($line) !== '';
    });
    
    $keywords = [];
    
    foreach ($lines as $line) {
        $line = trim($line);
        // 탭, 다중 공백, 단일 공백으로 분리
        $parts = preg_split('/\t+|\s{2,}|\s+/', $line);
        
        if (count($parts) >= 2) {
            $keyword = trim($parts[0]);
            $volumeStr = trim($parts[count($parts) - 1]);            
            // 콤마 제거 후 숫자 파싱
            $volume = intval(str_replace(',', '', $volumeStr));
            
            if (!empty($keyword) && $volume > 0) {
                $keywords[] = [
                    'keyword' => $keyword,
                    'volume' => $volume
                ];
            }
        }
    }
    
    // 검색량 기준 내림차순 정렬
    usort($keywords, function($a, $b) {
        return $b['volume'] - $a['volume'];
    });
    
    return $keywords;
}

// 통계 계산
function calculateStats($keywords) {
    if (empty($keywords)) return [];
    
    $totalKeywords = count($keywords);
    $totalVolume = array_sum(array_column($keywords, 'volume'));
    $avgVolume = round($totalVolume / $totalKeywords);
    $maxVolume = max(array_column($keywords, 'volume'));    
    return [
        'totalKeywords' => $totalKeywords,
        'totalVolume' => $totalVolume,
        'avgVolume' => $avgVolume,
        'maxVolume' => $maxVolume
    ];
}

$keywords = parseKeywordData($keywordData);

if (empty($keywords)) {
    die('올바른 키워드 데이터 형식이 아닙니다. 키워드와 검색량을 탭 또는 공백으로 구분해주세요.');
}

$stats = calculateStats($keywords);

// 날짜 포맷팅
$dateObj = DateTime::createFromFormat('Y-m-d', $reportDate);
if (!$dateObj) {
    $dateObj = new DateTime();
}
$formattedDate = $dateObj->format('Y.m.d');

// 파일명 생성 (특수문자 제거)
$safeClientName = preg_replace('/[^a-zA-Z0-9가-힣_-]/', '_', $clientName);
$safeDate = str_replace('.', '', $formattedDate);
$fileName = "keyword_report_{$safeClientName}_{$safeDate}.html";
// HTML 템플릿 생성 함수
function generateHtmlTemplate($clientName, $reportDate, $keywords, $stats, $safeDate) {
    $keywordsJson = json_encode($keywords, JSON_UNESCAPED_UNICODE);
    
    // HTML 템플릿 시작
    $template = '<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>키워드 분석 보고서 - ' . $clientName . '</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Noto Sans KR", sans-serif; background: #f0f2f5; min-height: 100vh; padding: 0; }
        .container { max-width: 1400px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 40px rgba(0, 0, 0, 0.08); }
        .header { background: linear-gradient(135deg, #6c63ff 0%, #4834d4 100%); padding: 60px 40px; position: relative; overflow: hidden; }
        .header-content { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; }
        .header-left { flex: 1; }
        .header h1 { font-size: 2.8rem; font-weight: 700; color: white; margin-bottom: 15px; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header .subtitle { font-size: 1.2rem; color: rgba(255, 255, 255, 0.9); font-weight: 300; letter-spacing: 0.5px; }
        .logo-container { background: rgba(255, 255, 255, 0.95); padding: 15px 25px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); display: flex; align-items: center; gap: 12px; }
        .logo-container .company-name { font-size: 1.1rem; font-weight: 600; color: #333; letter-spacing: -0.5px; }
        .client-info { background: #f8f9fb; padding: 35px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 25px; border-bottom: 1px solid #e8ebed; }
        .client-box, .company-box { background: white; padding: 25px 35px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); flex: 1; min-width: 280px; border: 1px solid #e8ebed; }
        .client-box h3, .company-box h3 { color: #6c63ff; font-size: 0.85rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
        .client-box p, .company-box p { font-size: 1.3rem; font-weight: 600; color: #2c3e50; }        .footer a { color: #6c63ff; text-decoration: none; font-weight: 600; transition: color 0.3s ease; }
        .footer a:hover { color: #a29bfe; }
        .footer .copyright { font-size: 1rem; margin-bottom: 8px; }
        .footer .website { font-size: 1rem; margin-bottom: 8px; }
        .footer .description { font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); margin-top: 15px; }
        .mobile-br { display: none; }
        @media (max-width: 768px) {
            .header h1 { font-size: 2.5rem; }
            .header-content { flex-direction: column; gap: 30px; }
            .controls { flex-direction: column; }
            .search-box { width: 100%; }
            .export-buttons { width: 100%; justify-content: center; }
            .footer .copyright { line-height: 1.6; }
            .mobile-br { display: block; }
            .header-left { text-align: center; }
            .header .subtitle { font-size: 0.8rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="header-left">
                    <h1>키워드 분석 보고서</h1>
                    <p class="subtitle">네이버 검색 최적화를 위한 데이터 기반 키워드 전략</p>
                </div>
                <div class="logo-container">
                    <div class="company-name">민컴퍼니인터내셔널</div>
                </div>            </div>
        </div>

        <div class="client-info">
            <div class="client-box">
                <h3>Client</h3>
                <p id="clientName">' . $clientName . '</p>
            </div>
            <div class="company-box">
                <h3>Report Generated</h3>
                <p id="reportDate">' . $reportDate . '</p>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="number" id="totalKeywords">' . $stats['totalKeywords'] . '</div>
                <div class="label">총 키워드 수</div>
            </div>
            <div class="stat-card">
                <div class="number" id="totalVolume">' . $stats['totalVolume'] . '</div>
                <div class="label">총 검색량</div>
            </div>
            <div class="stat-card">
                <div class="number" id="avgVolume">' . $stats['avgVolume'] . '</div>
                <div class="label">평균 검색량</div>
            </div>
            <div class="stat-card">
                <div class="number" id="maxVolume">' . $stats['maxVolume'] . '</div>
                <div class="label">최고 검색량</div>            </div>
        </div>

        <div class="controls">
            <div class="search-box">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input type="text" id="searchInput" placeholder="키워드 검색..." onkeyup="filterTable()">
            </div>
            
            <div class="export-buttons">
                <button class="btn btn-primary" onclick="exportToExcel()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span>EXCEL<br>다운로드</span>
                </button>
                <button class="btn btn-secondary" onclick="exportToPDF()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span>PDF<br>다운로드</span>                </button>
            </div>
        </div>
        
        <div class="table-container">
            <table class="keyword-table" id="keywordTable">
                <thead>
                    <tr>
                        <th class="rank-cell">No.</th>
                        <th>키워드</th>
                        <th>월간 검색량</th>
                    </tr>
                </thead>
                <tbody id="keywordBody"></tbody>
            </table>
        </div>

        <div class="footer">
            <p class="copyright">© 2025 민컴퍼니인터내셔널(주).<br class="mobile-br">All rights reserved.</p>
            <p class="website"><a href="https://min-company.co.kr">min-company.co.kr</a></p>
            <p class="description">본 보고서는 네이버 검색 데이터를 기반으로 <br class="mobile-br">작성되었으며, 실시간 트렌드를 반영합니다.</p>
        </div>
    </div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
    
    <script>
        const keywords = ' . $keywordsJson . ';
        function updateStats() {
            const totalKeywords = keywords.length;
            const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
            const avgVolume = Math.round(totalVolume / totalKeywords);
            const maxVolume = Math.max(...keywords.map(k => k.volume));

            document.getElementById("totalKeywords").textContent = totalKeywords.toLocaleString();
            document.getElementById("totalVolume").textContent = totalVolume.toLocaleString();
            document.getElementById("avgVolume").textContent = avgVolume.toLocaleString();
            document.getElementById("maxVolume").textContent = maxVolume.toLocaleString();
        }

        function renderTable(data = keywords) {
            const tbody = document.getElementById("keywordBody");
            tbody.innerHTML = "";
            
            data.forEach((item, index) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td class="rank-cell">${index + 1}</td>
                    <td class="keyword-cell">${item.keyword}</td>
                    <td class="volume-cell">${item.volume.toLocaleString()}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        function filterTable() {
            const searchTerm = document.getElementById("searchInput").value.toLowerCase();            const filteredData = keywords.filter(k => 
                k.keyword.toLowerCase().includes(searchTerm)
            );
            renderTable(filteredData);
        }

        function exportToExcel() {
            const ws_data = [
                ["순위", "키워드", "월간 검색량"],
                ...keywords.map((k, i) => [i + 1, k.keyword, k.volume])
            ];
            
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "키워드분석");
            
            ws["!cols"] = [
                {wch: 8},
                {wch: 30},
                {wch: 15}
            ];
            
            const fileName = "키워드분석보고서_' . $clientName . '_' . $safeDate . '.xlsx";
            XLSX.writeFile(wb, fileName);
        }
        
        function exportToPDF() {
            const element = document.querySelector(".container");
            
            html2canvas(element, {                scale: 2,
                allowTaint: true,
                useCORS: true
            }).then(function(canvas) {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF("p", "mm", "a4");
                
                const imgData = canvas.toDataURL("image/png");
                const imgWidth = 210;
                const pageHeight = 295;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                let heightLeft = imgHeight;
                let position = 0;

                doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    doc.addPage();
                    doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                const fileName = "키워드분석보고서_' . $clientName . '_' . $safeDate . '.pdf";
                doc.save(fileName);
            });
        }

        document.addEventListener("DOMContentLoaded", function() {            updateStats();
            renderTable();
        });
    </script>
</body>
</html>';

    return $template;
}

// HTML 생성
$htmlContent = generateHtmlTemplate($clientName, $formattedDate, $keywords, $stats, $safeDate);

// export 폴더 생성 (없으면)
$exportDir = __DIR__ . '/export';
if (!is_dir($exportDir)) {
    mkdir($exportDir, 0755, true);
}

// 파일 저장
$filePath = $exportDir . '/' . $fileName;
if (file_put_contents($filePath, $htmlContent)) {
    // 성공 페이지 표시
    $reportUrl = 'http://minc.dothome.co.kr/report/export/' . $fileName;
    $formattedTotalVolume = number_format($stats['totalVolume']);
    
    echo '<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">    <title>보고서 생성 완료</title>
    <style>
        body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f0f2f5 0%, #e8eaf6 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: 600px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            padding: 40px;
            text-align: center;
        }
        .success-icon {
            font-size: 4rem;
            color: #28a745;
            margin-bottom: 20px;
        }
        h1 {
            color: #28a745;
            margin-bottom: 20px;
            font-size: 2rem;
        }
        .info {            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        .info strong {
            color: #333;
        }
        .link {
            background: linear-gradient(135deg, #6c63ff 0%, #4834d4 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            display: inline-block;
            margin: 20px 10px;
            transition: transform 0.3s ease;
        }
        .link:hover {
            transform: translateY(-2px);
            text-decoration: none;
            color: white;
        }
        .back-link {
            background: #6c757d;
        }
    </style>
</head><body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>보고서 생성 완료!</h1>
        
        <div class="info">
            <p><strong>고객사:</strong> ' . $clientName . '</p>
            <p><strong>키워드 수:</strong> ' . $stats['totalKeywords'] . '개</p>
            <p><strong>총 검색량:</strong> ' . $formattedTotalVolume . '</p>
            <p><strong>파일명:</strong> ' . $fileName . '</p>
        </div>
        
        <a href="' . $reportUrl . '" target="_blank" class="link">📊 보고서 보기</a>
        <a href="http://minc.dothome.co.kr/report/" class="link back-link">🔄 새 보고서 만들기</a>
        
        <p style="margin-top: 20px; color: #666; font-size: 0.9rem;">
            생성된 보고서 링크를 고객에게 전달하세요.
        </p>
    </div>
</body>
</html>';
    
} else {
    echo "파일 저장 중 오류가 발생했습니다.";
}
?>