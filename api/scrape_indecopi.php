<?php

// Set centralized error log file
ini_set('error_log', 'f:\TRABAJO_GESTION_EDUCATIVA\GESTION_CASOS\logs\error_log');

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    error_log("Input Data: " . json_encode($input)); // Log input data for debugging

    $expedienteNumero = $input['expedienteNumero'] ?? null;
    $expedienteUrl = $input['expedienteUrl'] ?? null;

    if (!$expedienteNumero || !$expedienteUrl) {
        error_log("Invalid request: Missing or invalid expedienteNumero or expedienteUrl. Input: " . json_encode($input));
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid request',
            'details' => 'Missing or invalid expedienteNumero or expedienteUrl. Please ensure all required fields are provided.',
        ]);
        exit;
    }

    if (strpos($expedienteUrl, 'indecopi.gob.pe') === false) {
        error_log("Invalid URL domain: $expedienteUrl");
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid URL domain',
            'details' => 'Este servicio solo permite consultas al sistema de INDECOPI.',
        ]);
        exit;
    }

    try {
        error_log("Processing INDECOPI URL: $expedienteUrl"); // Log the URL being processed

        // Fetch data from the INDECOPI URL
        $response = @file_get_contents($expedienteUrl);
        if ($response === false) {
            $error = error_get_last();
            error_log("INDECOPI Error: Failed to fetch data. Details: " . json_encode($error));
            throw new Exception("Failed to fetch data from INDECOPI URL: $expedienteUrl. Error: " . ($error['message'] ?? 'Unknown error'));
        }
        error_log("Data fetched successfully from INDECOPI URL: $expedienteUrl");

        // Log raw HTML content for debugging
        error_log("Raw HTML content from INDECOPI response: " . substr($response, 0, 1000));

        $dom = new DOMDocument();
        @$dom->loadHTML($response);
        $xpath = new DOMXPath($dom);

        // Check if the response contains an iframe or dynamic content
        $iframeNodes = $xpath->query("//iframe");
        if ($iframeNodes->length > 0) {
            error_log("Iframe detected in INDECOPI response. URL: " . $iframeNodes->item(0)->getAttribute('src'));
            throw new Exception("Dynamic content detected. Parsing iframe or JS-loaded content is not supported.");
        }

        // Log if the script tag is present
        $scriptNodes = $xpath->query("//script");
        if ($scriptNodes->length > 0) {
            error_log("Script tags detected in INDECOPI response. Content may be dynamically loaded.");
        }

        // Extract rows from the follow-up table
        $rows = $xpath->query("//tr[contains(@class, 'resultados-item-res')]");
        $followups = [];

        if ($rows->length === 0) {
            error_log("No rows found in the table with class 'resultados-item-res'. Raw response: " . substr($response, 0, 1000));
            // Mensaje formal y detallado para el frontend
            throw new Exception("Hubo un error con la página de INDECOPI. No se pudo obtener información de seguimiento para el expediente solicitado. Esto puede deberse a que el expediente no está disponible en el sistema de INDECOPI, la página se encuentra temporalmente fuera de servicio, o el formato de la información ha cambiado. Por favor, verifique los datos ingresados o intente nuevamente más tarde. Si el problema persiste, comuníquese con el área legal para una revisión manual.");
        }

        foreach ($rows as $row) {
            $cells = $row->getElementsByTagName('td');
            if ($cells->length === 3) {
                $followups[] = [
                    'fecha' => trim($cells->item(0)->nodeValue),
                    'actividad' => trim($cells->item(1)->nodeValue),
                    'piezas' => trim($cells->item(2)->nodeValue),
                ];
            }
        }

        if (empty($followups)) {
            error_log("No follow-up data extracted. Raw response: " . substr($response, 0, 1000));
            // Mensaje formal y detallado para el frontend
            throw new Exception("Hubo un error con la página de INDECOPI. No se pudo obtener información de seguimiento para el expediente solicitado. Esto puede deberse a que el expediente no está disponible en el sistema de INDECOPI, la página se encuentra temporalmente fuera de servicio, o el formato de la información ha cambiado. Por favor, verifique los datos ingresados o intente nuevamente más tarde. Si el problema persiste, comuníquese con el área legal para una revisión manual.");
        }

        echo json_encode([
            'activity' => $followups[0]['fecha'] . " - " . $followups[0]['actividad'],
            'followups' => $followups,
        ]);
    } catch (Exception $e) {
        error_log("INDECOPI Error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}