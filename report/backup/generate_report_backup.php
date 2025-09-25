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

// HTML 템플릿 생성
function generateHtmlTemplate($clientName, $reportDate, $keywords, $stats, $safeDate) {
    $keywordsJson = json_encode($keywords, JSON_UNESCAPED_UNICODE);
    
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

        .container {
            max-width: 1400px;
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

        .logo-container {
            background: rgba(255, 255, 255, 0.95);
            padding: 15px 25px;            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 12px;
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
            padding: 25px 35px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);            flex: 1;
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