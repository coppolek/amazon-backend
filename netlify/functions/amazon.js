/**
 * BACKEND SERVERLESS FUNCTION per Amazon RSS Generator
 * * Questa funzione è pensata per essere ospitata su una piattaforma come Netlify,
 * Vercel, o AWS Lambda. Agisce come un intermediario sicuro tra la tua
 * app React e l'API di Amazon.
 * * PREREQUISITI PER LA PUBBLICAZIONE:
 * 1. Crea un file 'package.json' e aggiungi 'amazon-paapi' alle dipendenze.
 * Esegui: npm init -y && npm install amazon-paapi
 * 2. Imposta le seguenti variabili d'ambiente nella tua piattaforma di hosting:
 * - AMAZON_ACCESS_KEY: La tua chiave di accesso Amazon.
 * - AMAZON_SECRET_KEY: La tua chiave segreta Amazon.
 * - AMAZON_PARTNER_TAG: Il tuo tag di affiliazione (es. miotag-21).
 */

// Importa la libreria per comunicare con l'API di Amazon
const { AmazonApi } = require('amazon-paapi');

// La funzione principale che viene eseguita quando viene chiamata l'API.
// 'event' contiene i dati della richiesta (es. il body).
exports.handler = async (event) => {
    // --- CONFIGURAZIONE DI SICUREZZA ---
    // Permetti richieste solo dalla tua app React (cambia con il tuo dominio)
    const allowedOrigin = "*"; // In produzione, cambialo con 'https://tuo-sito.com'

    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // L'API di Amazon non supporta richieste OPTIONS, quindi gestiamo
    // la richiesta pre-flight del browser restituendo subito una risposta positiva.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    // --- VALIDAZIONE DELLA RICHIESTA ---
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Metodo non consentito. Usare POST.' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Corpo della richiesta non valido (JSON malformato).' })
        };
    }

    const { keywords, min_saving_percent } = body;

    if (!keywords) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Il parametro "keywords" è obbligatorio.' })
        };
    }
    
    // --- CHIAMATA ALL'API DI AMAZON ---
    try {
        // Inizializza l'API usando le variabili d'ambiente sicure
        const amazon = new AmazonApi(
            process.env.AMAZON_ACCESS_KEY,
            process.env.AMAZON_SECRET_KEY,
            process.env.AMAZON_PARTNER_TAG,
            'it' // Paese: Italia
        );

        // Esegui la ricerca
        const response = await amazon.searchItems({
            keywords: keywords,
            minSavingPercent: min_saving_percent || 10, // Sconto minimo, default 10%
            resources: [
                "Images.Primary.Medium",
                "ItemInfo.Title",
                "Offers.Listings.Price",
            ]
        });
        
        // Estrai e formatta i dati importanti dalla risposta di Amazon
        const products = response.SearchResult.Items.map(item => ({
            title: item.ItemInfo.Title.DisplayValue,
            link: item.DetailPageURL,
            imageUrl: item.Images?.Primary?.Medium?.URL || 'https://placehold.co/400x400/cccccc/ffffff?text=No+Image',
            price: item.Offers?.Listings[0]?.Price?.DisplayAmount || 'N/D'
        }));

        // Invia i prodotti trovati al frontend
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ products })
        };

    } catch (error) {
        console.error("Errore API Amazon:", error);
        // Non mostrare dettagli dell'errore al client per sicurezza
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Errore durante la comunicazione con l\'API di Amazon. Controlla le credenziali e i log del backend.' })
        };
    }
};
