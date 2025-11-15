import { GpxPoint } from '../types';

function perpendicularDistance(point: GpxPoint, lineStart: GpxPoint, lineEnd: GpxPoint): number {
    const dx = lineEnd.lon - lineStart.lon;
    const dy = lineEnd.lat - lineStart.lat;

    if (dx === 0 && dy === 0) {
        // lineStart and lineEnd are the same point
        const pointDx = point.lon - lineStart.lon;
        const pointDy = point.lat - lineStart.lat;
        return Math.sqrt(pointDx * pointDx + pointDy * pointDy);
    }

    const t = ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) / (dx * dx + dy * dy);

    let closestPointLon: number;
    let closestPointLat: number;

    if (t < 0) {
        closestPointLon = lineStart.lon;
        closestPointLat = lineStart.lat;
    } else if (t > 1) {
        closestPointLon = lineEnd.lon;
        closestPointLat = lineEnd.lat;
    } else {
        closestPointLon = lineStart.lon + t * dx;
        closestPointLat = lineStart.lat + t * dy;
    }

    const distDx = point.lon - closestPointLon;
    const distDy = point.lat - closestPointLat;
    return Math.sqrt(distDx * distDx + distDy * distDy);
}

export function douglasPeucker(points: GpxPoint[], epsilon: number): GpxPoint[] {
    if (points.length < 3) {
        return points;
    }

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
        const recResults2 = douglasPeucker(points.slice(index), epsilon);

        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [points[0], points[end]];
    }
}
