import { Day, GpxPoint } from '../types';

// Algoritmo Douglas-Peucker per semplificazione intelligente
export const simplifyGpxTrack = (points: GpxPoint[], tolerance: number = 0.001): GpxPoint[] => {
    if (points.length <= 2) return points;
    
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
        const distance = perpendicularDistance(points[i], start, end);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }
    
    if (maxDistance > tolerance) {
        const left = simplifyGpxTrack(points.slice(0, maxIndex + 1), tolerance);
        const right = simplifyGpxTrack(points.slice(maxIndex), tolerance);
        return [...left.slice(0, -1), ...right];
    }
    
    return [start, end];
};

// Calcola la distanza perpendicolare da un punto a un segmento di linea.
// Questa è l'implementazione corretta per l'algoritmo di Douglas-Peucker.
const perpendicularDistance = (point: GpxPoint, lineStart: GpxPoint, lineEnd: GpxPoint): number => {
    const dx = lineEnd.lon - lineStart.lon;
    const dy = lineEnd.lat - lineStart.lat;

    if (dx === 0 && dy === 0) {
        // lineStart e lineEnd sono lo stesso punto
        const pointDx = point.lon - lineStart.lon;
        const pointDy = point.lat - lineStart.lat;
        return Math.sqrt(pointDx * pointDx + pointDy * pointDy);
    }

    // Calcola la proiezione del punto sulla linea. 
    // t è la posizione del punto più vicino sulla linea infinita rispetto al segmento.
    // t=0 è lineStart, t=1 è lineEnd.
    const t = ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) / (dx * dx + dy * dy);

    let closestPointLon: number;
    let closestPointLat: number;

    if (t < 0) {
        // La proiezione è prima dell'inizio del segmento, quindi il punto più vicino è l'inizio.
        closestPointLon = lineStart.lon;
        closestPointLat = lineStart.lat;
    } else if (t > 1) {
        // La proiezione è dopo la fine del segmento, quindi il punto più vicino è la fine.
        closestPointLon = lineEnd.lon;
        closestPointLat = lineEnd.lat;
    } else {
        // La proiezione è all'interno del segmento.
        closestPointLon = lineStart.lon + t * dx;
        closestPointLat = lineStart.lat + t * dy;
    }

    const distDx = point.lon - closestPointLon;
    const distDy = point.lat - closestPointLat;
    return Math.sqrt(distDx * distDx + distDy * distDy);
};


// Crea segmenti navigabili (max 9 waypoints per segmento + origine e destinazione)
export const createNavigationSegments = (
    points: GpxPoint[], 
    options: { maxWaypointsPerSegment?: number; } = {}
) => {
    const { maxWaypointsPerSegment = 9 } = options;
    const segments = [];
    
    // Semplifica sempre il tracciato in ingresso con la massima precisione per garantire la fedeltà del percorso.
    const pointsToSegment = simplifyGpxTrack(points, 0.00005);
    
    for (let i = 0; i < pointsToSegment.length - 1; i += maxWaypointsPerSegment) {
        const segmentPoints = pointsToSegment.slice(i, i + maxWaypointsPerSegment + 1);
        
        if (segmentPoints.length < 2) continue;
        
        const origin = segmentPoints[0];
        const destination = segmentPoints[segmentPoints.length - 1];
        const waypoints = segmentPoints.slice(1, -1);
        
        const waypointsStr = waypoints.map(p => `${p.lat},${p.lon}`).join('|');
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}&waypoints=${waypointsStr}&travelmode=driving`;
        
        segments.push({
            segmentNumber: segments.length + 1,
            mapUrl: url,
            pointCount: segmentPoints.length
        });
    }
    
    return segments;
};

// Genera GPX per una tappa
export const generateGpxFile = (day: Day): string => {
    const points = day.gpxTrack || [];
    const simplified = simplifyGpxTrack(points, 0.0005);
    
    const trackPoints = simplified
        .map(p => `      <trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`)
        .join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoMentor AI" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${day.stageTitle}</name>
    <desc>${day.routeDescription}</desc>
  </metadata>
  <trk>
    <name>Giorno ${day.day}: ${day.stageTitle}</name>
    <type>motorcycle</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
};

// Genera GPX per intero viaggio
export const generateFullTripGpx = (days: Day[], tripTitle: string): string => {
    const allSegments = days.map(day => {
        const points = day.gpxTrack || [];
        const simplified = simplifyGpxTrack(points, 0.0005);
        
        return `    <trkseg>
${simplified.map(p => `      <trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`).join('\n')}
    </trkseg>`;
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoMentor AI" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${tripTitle}</name>
    <desc>Viaggio in moto di ${days.length} giorni</desc>
  </metadata>
  <trk>
    <name>${tripTitle}</name>
${allSegments}
  </trk>
</gpx>`;
};

// Download helper
export const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};