<?php
// 멀티 API 설정 (최대 5개)
// 각 API는 순서대로 시도되며, 실패 시 다음 API로 자동 전환
$API_CONFIGS = [
    // API 1
    [
        'CUSTOMER_ID'    => '2521363',
        'ACCESS_LICENSE' => '01000000000f6f6b9c7efb872210d906b908a116eb4d9c10366333d420db7ad2728add6612',
        'SECRET_KEY'     => 'AQAAAAAPb2ucfvuHIhDZBrkIoRbrRZ5myUwU4dD/OkGTwmfv/Q==',
        'NAME'           => 'API 1 (기본)'
    ],
    // API 2 - 필요시 활성화
    
    [
        'CUSTOMER_ID'    => '1502093',
        'ACCESS_LICENSE' => '0100000000e2de2afc13e5c0bd2b7b92677c6d84002e031dd41afbbe29cb24362c9548a346',
        'SECRET_KEY'     => 'AQAAAADi3ir8E+XAvSt7kmd8bYQA15MfAu0rgq0iBgQnB758sA==',
        'NAME'           => 'API 2'
    ],
    
    // API 3 - 필요시 활성화
    /*
    [
        'CUSTOMER_ID'    => 'YOUR_CUSTOMER_ID_3',
        'ACCESS_LICENSE' => 'YOUR_ACCESS_LICENSE_3',
        'SECRET_KEY'     => 'YOUR_SECRET_KEY_3',
        'NAME'           => 'API 3'
    ],
    */
    // API 4 - 필요시 활성화
    /*
    [
        'CUSTOMER_ID'    => 'YOUR_CUSTOMER_ID_4',
        'ACCESS_LICENSE' => 'YOUR_ACCESS_LICENSE_4',
        'SECRET_KEY'     => 'YOUR_SECRET_KEY_4',
        'NAME'           => 'API 4'
    ],
    */
    // API 5 - 필요시 활성화
    /*
    [
        'CUSTOMER_ID'    => 'YOUR_CUSTOMER_ID_5',
        'ACCESS_LICENSE' => 'YOUR_ACCESS_LICENSE_5',
        'SECRET_KEY'     => 'YOUR_SECRET_KEY_5',
        'NAME'           => 'API 5'
    ],
    */
];

// 활성화된 API만 필터링
$API_CONFIGS = array_values(array_filter($API_CONFIGS, function($config) {
    return !empty($config['CUSTOMER_ID']) && 
           !empty($config['ACCESS_LICENSE']) && 
           !empty($config['SECRET_KEY']);
}));

// UI 기본값
const DEFAULT_REQUEST_INTERVAL_MS = 100;  // 기본 요청 간격(ms)

// 네이버 검색광고 API
const NAVER_API_BASE = 'https://api.searchad.naver.com';
const NAVER_API_PATH = '/keywordstool';
