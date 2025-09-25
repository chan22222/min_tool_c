<?php
/**
 * 프로젝트명으로부터 폴더명을 생성하는 함수
 * JavaScript의 해시 함수와 동일한 결과를 반환
 */
function getProjectFolderName($project_name) {
    // 빈 문자열 처리
    if (empty($project_name)) {
        return 'project_0000000000000000';
    }
    
    // JavaScript의 32비트 정수 해시 함수 구현
    $hash = 0;
    $len = mb_strlen($project_name, 'UTF-8');
    
    for ($i = 0; $i < $len; $i++) {
        // UTF-8 문자 처리
        $char = mb_substr($project_name, $i, 1, 'UTF-8');
        $charCode = mb_ord($char, 'UTF-8');
        
        // JavaScript와 동일한 해시 계산
        $temp = (($hash << 5) - $hash) + $charCode;
        
        // 32비트 정수로 변환 (오버플로우 처리)
        // JavaScript의 비트 연산은 32비트로 제한됨
        $hash = $temp & 0xFFFFFFFF;
        
        // 부호있는 32비트 정수로 변환
        if ($hash >= 0x80000000) {
            $hash = $hash - 0x100000000;
        }
    }
    
    // 음수를 양수로 변환
    $absHash = abs($hash);
    
    // 16진수 문자열로 변환
    $hex = dechex($absHash);
    
    // 16자리로 맞춤 (JavaScript와 동일)
    if (strlen($hex) > 16) {
        $hex = substr($hex, 0, 16);
    } else {
        $hex = str_pad($hex, 16, '0', STR_PAD_RIGHT);
    }
    
    return 'project_' . $hex;
}

/**
 * 멀티바이트 문자의 유니코드 값을 반환
 * PHP 7.2 이상에서는 mb_ord 사용, 이전 버전에서는 대체 구현
 */
if (!function_exists('mb_ord')) {
    function mb_ord($char, $encoding = 'UTF-8') {
        if ($encoding === 'UTF-8') {
            $char = mb_convert_encoding($char, 'UTF-32BE', 'UTF-8');
            return hexdec(bin2hex($char));
        }
        return ord($char);
    }
}
?>