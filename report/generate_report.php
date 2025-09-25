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
    $seenKeywords = []; // 중복 체크용 배열
    
    foreach ($lines as $line) {
        $line = trim($line);
        // 탭, 다중 공백, 단일 공백으로 분리
        $parts = preg_split('/\t+|\s{2,}|\s+/', $line);
        
        if (count($parts) >= 2) {
            $keyword = trim($parts[0]);
            $volumeStr = trim($parts[count($parts) - 1]);            
            // 콤마 제거 후 숫자 파싱
            $volume = intval(str_replace(',', '', $volumeStr));
            
            // 중복 체크: 이미 추가된 키워드가 아닌 경우만 추가
            if (!empty($keyword) && $volume > 0 && !in_array($keyword, $seenKeywords)) {
                $keywords[] = [
                    'keyword' => $keyword,
                    'volume' => $volume
                ];
                $seenKeywords[] = $keyword; // 중복 방지를 위해 기록
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
$fileName = "{$safeDate}_report_{$safeClientName}.html";
// HTML 템플릿 생성
function generateHtmlTemplate($clientName, $reportDate, $keywords, $stats, $safeDate) {
    $keywordsJson = json_encode($keywords, JSON_UNESCAPED_UNICODE);
    
    // 통계 값 포맷팅
    $totalKeywords = number_format($stats['totalKeywords']);
    $totalVolume = number_format($stats['totalVolume']);
    $avgVolume = number_format($stats['avgVolume']);
    $maxVolume = number_format($stats['maxVolume']);
    
    $template = <<<HTML
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>키워드 분석 보고서 - {$clientName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f0f2f5;
            min-height: 100vh;
            padding: 0;
        }

        .container {            max-width: 1400px;
            margin: 0 auto;
            background: #ffffff;
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.08);
        }

        .header {
            background: linear-gradient(135deg, #6c63ff 0%, #4834d4 100%);
            padding: 60px 40px;
            position: relative;
            overflow: hidden;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            animation: drift 20s infinite linear;
        }

        @keyframes drift {
            from { transform: translate(0, 0); }
            to { transform: translate(60px, 60px); }
        }        
        .header-content {
            position: relative;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header-left {
            flex: 1;
        }

        .header h1 {
            font-size: 2.8rem;
            font-weight: 700;
            color: white;
            margin-bottom: 15px;
            letter-spacing: -1px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .header .subtitle {
            font-size: 1.2rem;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 300;
            letter-spacing: 0.5px;
        }

        .logo-container {            background: rgba(255, 255, 255, 0.95);
            padding: 15px 25px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .logo-container .logo-img {
            width: 250px;
            height: 80px;
            border-radius: 10px;
            object-fit: contain;
        }
        
        .logo-container .company-name {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
            letter-spacing: -0.5px;
        }

        .client-info {
            background: #f8f9fb;
            padding: 35px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 25px;
            border-bottom: 1px solid #e8ebed;
        }
        
        .client-box, .company-box {
            background: white;
            padding: 25px 35px;            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            flex: 1;
            min-width: 280px;
            border: 1px solid #e8ebed;
        }

        .client-box h3, .company-box h3 {
            color: #6c63ff;
            font-size: 0.85rem;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 600;
        }

        .client-box p, .company-box p {
            font-size: 1.3rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .stats {
            padding: 50px 40px;
            background: white;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 30px;
        }
HTML;
    $template .= <<<HTML
        
        .stat-card {
            background: linear-gradient(135deg, #f8f9fb 0%, #ffffff 100%);
            padding: 30px;
            border-radius: 16px;
            text-align: center;
            border: 1px solid #e8ebed;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(135deg, #6c63ff 0%, #4834d4 100%);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 15px 35px rgba(108, 99, 255, 0.15);
        }
        .stat-card:hover::before {
            transform: scaleX(1);
        }
        
        .stat-card .number {
            font-size: 2.8rem;
            font-weight: 700;
            background: linear-gradient(135deg, #6c63ff 0%, #4834d4 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }

        .stat-card .label {
            font-size: 0.95rem;
            color: #7a8a9e;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .controls {
            padding: 35px 40px;
            background: #f8f9fb;
            border-top: 1px solid #e8ebed;
            border-bottom: 1px solid #e8ebed;
            display: flex;
            justify-content: space-between;
            align-items: center;            flex-wrap: wrap;
            gap: 25px;
        }
        
        .search-box {
            flex: 1;
            min-width: 320px;
            position: relative;
        }

        .search-box input {
            width: 100%;
            padding: 14px 24px 14px 50px;
            border: 2px solid #e8ebed;
            border-radius: 12px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: white;
        }

        .search-box input:focus {
            outline: none;
            border-color: #6c63ff;
            box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.1);
        }

        .search-icon {
            position: absolute;
            left: 18px;
            top: 50%;            transform: translateY(-50%);
            color: #7a8a9e;
        }
        
        .export-buttons {
            display: flex;
            gap: 15px;
        }

        .btn {
            padding: 14px 28px;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 10px;
            position: relative;
            overflow: hidden;
        }

        .btn span {
            text-align: center;
            line-height: 1.2;
        }

        .btn::before {            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }
        
        .btn:hover::before {
            width: 300px;
            height: 300px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #6c63ff 0%, #4834d4 100%);
            color: white;
            position: relative;
            z-index: 1;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(108, 99, 255, 0.25);
        }

        .btn-secondary {            background: white;
            color: #6c63ff;
            border: 2px solid #6c63ff;
        }

        .btn-secondary:hover {
            background: #6c63ff;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(108, 99, 255, 0.15);
        }
        
        .table-container {
            padding: 0;
            background: white;
            max-height: 700px;
            overflow-y: auto;
        }

        .table-container::-webkit-scrollbar {
            width: 8px;
        }

        .table-container::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        .table-container::-webkit-scrollbar-thumb {
            background: #6c63ff;            border-radius: 10px;
        }

        .table-container::-webkit-scrollbar-thumb:hover {
            background: #4834d4;
        }

        .keyword-table {
            width: 100%;
            background: white;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
        }
        
        .keyword-table thead {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .keyword-table th {
            padding: 15px 8px;
            text-align: center;
            font-weight: 600;
            color: white;
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;            border-bottom: 2px solid #e8ebed;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .keyword-table tbody tr {
            border-bottom: 1px solid #f0f0f0;
            transition: all 0.2s ease;
        }

        .keyword-table tbody tr:hover {
            background: linear-gradient(90deg, #f8f9fb 0%, #ffffff 100%);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        
        .keyword-table td {
            padding: 15px 8px;
            font-size: 1rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
        }

        .keyword-cell {
            font-weight: 500;
            color: #2c3e50;
        }
        .volume-cell {
            font-weight: 600;
            color: #6c63ff;
            font-size: 1.05rem;
        }

        .rank-cell {
            width: 120px;
            color: #7a8a9e;
            font-weight: 600;
        }

        .footer {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            padding: 40px;
            text-align: center;
            color: white;
        }
        
        .footer a {
            color: #6c63ff;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.3s ease;
        }

        .footer a:hover {
            color: #a29bfe;
        }
        .footer .copyright {
            font-size: 1rem;
            margin-bottom: 8px;
        }

        .footer .website {
            font-size: 1rem;
            margin-bottom: 8px;
        }

        .footer .description {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.8);
            margin-top: 15px;
        }

        .mobile-br {
            display: none;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2.5rem;
            }

            .header-content {
                flex-direction: column;
                gap: 30px;
            }            
            .controls {
                flex-direction: column;
            }

            .search-box {
                width: 100%;
            }

            .export-buttons {
                width: 100%;
                justify-content: center;
            }
            
            .footer .copyright {
                line-height: 1.6;
            }
            
            .mobile-br {
                display: block;
            }
            
            .header-left {
                text-align: center;
            }
            
            .logo-container .logo-img {
                width: 200px;
                height: 60px;
            }
            
            .header .subtitle {
                font-size: 0.8rem;
            }
        }
        @media (min-width: 769px) {
            .rank-cell {
                width: 100px;
            }
            
            .keyword-table th:nth-child(2),
            .keyword-table td:nth-child(2) {
                width: 60%;
            }
            
            .keyword-table th:nth-child(3),
            .keyword-table td:nth-child(3) {
                width: 25%;
            }
        }

        .loading {
            display: none;
            text-align: center;
            padding: 30px;
            color: #6c63ff;
            font-size: 1.1rem;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .loading.active {
            display: block;
            animation: pulse 1.5s infinite;
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
                    <img src="logo.png" alt="민컴퍼니인터내셔널" class="logo-img">
                </div>
            </div>
        </div>

        <div class="client-info">
            <div class="client-box">
                <h3>Client</h3>
                <p id="clientName">{$clientName}</p>
            </div>
            <div class="company-box">
                <h3>Report Generated</h3>
                <p id="reportDate">{$reportDate}</p>            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="number" id="totalKeywords">{$totalKeywords}</div>
                <div class="label">총 키워드 수</div>
            </div>
            <div class="stat-card">
                <div class="number" id="totalVolume">{$totalVolume}</div>
                <div class="label">총 검색량</div>
            </div>
            <div class="stat-card">
                <div class="number" id="avgVolume">{$avgVolume}</div>
                <div class="label">평균 검색량</div>
            </div>
            <div class="stat-card">
                <div class="number" id="maxVolume">{$maxVolume}</div>
                <div class="label">최고 검색량</div>
            </div>
        </div>

        <div class="controls">
            <div class="search-box">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input type="text" id="searchInput" placeholder="키워드 검색..." onkeyup="filterTable()">            </div>
            
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
            </div>
        </div>
        
        <div class="table-container">
            <table class="keyword-table" id="keywordTable">
                <thead>
                    <tr>
                        <th class="rank-cell">No.</th>
                        <th>키워드</th>                        <th>월간 검색량</th>
                    </tr>
                </thead>
                <tbody id="keywordBody">
                    <!-- 키워드 데이터가 여기에 추가됩니다 -->
                </tbody>
            </table>
            <div class="loading" id="loadingIndicator">데이터를 불러오는 중...</div>
        </div>

        <div class="footer">
            <p class="copyright">© 2025 민컴퍼니인터내셔널(주).<br class="mobile-br">All rights reserved.</p>
            <p class="website"><a href="https://min-company.co.kr">min-company.co.kr</a></p>
            <p class="description">본 보고서는 네이버 검색 데이터를 기반으로 <br class="mobile-br">작성되었으며, 실시간 트렌드를 반영합니다.</p>
        </div>
    </div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    
    <script>
        // 키워드 데이터
        const keywords = {$keywordsJson};
        console.log('Keywords loaded:', keywords);

        // 통계 업데이트
        function updateStats() {
            const totalKeywords = keywords.length;
            const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
            const avgVolume = Math.round(totalVolume / totalKeywords);
            const maxVolume = Math.max(...keywords.map(k => k.volume));

            document.getElementById('totalKeywords').textContent = totalKeywords.toLocaleString();
            document.getElementById('totalVolume').textContent = totalVolume.toLocaleString();
            document.getElementById('avgVolume').textContent = avgVolume.toLocaleString();
            document.getElementById('maxVolume').textContent = maxVolume.toLocaleString();
        }

        // 테이블 렌더링
        function renderTable(data = keywords) {
            console.log('Rendering table with data:', data);
            const tbody = document.getElementById('keywordBody');
            tbody.innerHTML = '';
            
            data.forEach((item, index) => {
                const row = '<tr>' +
                    '<td class="rank-cell">' + (index + 1) + '</td>' +
                    '<td class="keyword-cell">' + item.keyword + '</td>' +
                    '<td class="volume-cell">' + item.volume.toLocaleString() + '</td>' +
                    '</tr>';
                tbody.innerHTML += row;
            });
            console.log('Table rendered, rows:', tbody.children.length);
        }
        
        // 검색 필터
        function filterTable() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const filteredData = keywords.filter(k => 
                k.keyword.toLowerCase().includes(searchTerm)
            );
            renderTable(filteredData);
        }

        // Excel 내보내기
        function exportToExcel() {
            const ws_data = [
                ['순위', '키워드', '월간 검색량'],
                ...keywords.map((k, i) => [i + 1, k.keyword, k.volume])
            ];
            
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '키워드분석');
            
            // 컬럼 너비 설정
            ws['!cols'] = [
                {wch: 8},  // 순위
                {wch: 30}, // 키워드
                {wch: 15}  // 검색량
            ];
            
            const fileName = '{$safeDate}_report_{$clientName}.xlsx';
            XLSX.writeFile(wb, fileName);
        }

        // 페이지 로드 시 초기화
                    // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded, initializing...');
            updateStats();
            renderTable();
        });
        
        // 폴백: 만약 DOMContentLoaded가 이미 발생했다면 즉시 실행
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            console.log('DOM already loaded, initializing immediately...');
            updateStats();
            renderTable();
        }
    </script>
</body>
</html>
HTML;

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
        echo <<<HTML
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>보고서 생성 완료</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
        h1 {            color: #28a745;
            margin-bottom: 20px;
            font-size: 2rem;
        }
        .info {
            background: #f8f9fa;
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
        }        .back-link {
            background: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>보고서 생성 완료!</h1>
        
        <div class="info">
            <p><strong>고객사:</strong> {$clientName}</p>
            <p><strong>키워드 수:</strong> {$stats['totalKeywords']}개</p>
            <p><strong>총 검색량:</strong> {$formattedTotalVolume}</p>
            <p><strong>파일명:</strong> {$fileName}</p>
        </div>
        
        <a href="{$reportUrl}" target="_blank" class="link">📊 보고서 보기</a>
        <a href="http://minc.dothome.co.kr/report/" class="link back-link">🔄 새 보고서 만들기</a>
        
        <p style="margin-top: 20px; color: #666; font-size: 0.9rem;">
            생성된 보고서 링크를 고객에게 전달하세요.
        </p>
    </div>
</body>
</html>
HTML;
    
} else {
    echo "파일 저장 중 오류가 발생했습니다.";
}?>