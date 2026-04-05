/**
 * Dossiers Service — Eagle Insight Local MVP
 *
 * A dossier represents one flight's analysis package:
 * the flight metadata + all associated findings.
 */
import { findingsService } from './findings-service';
export type DossierStatus = 'new' | 'in_review' | 'findings_open' | 'all_resolved' | 'archived';
export interface Dossier {
    id: string;
    flightId?: string;
    tailNumber?: string;
    flightDate?: string;
    pilotName?: string;
    status: DossierStatus;
    summary?: string;
    createdAt: string;
    updatedAt: string;
}
export interface DossierWithFindings extends Dossier {
    findings: ReturnType<typeof findingsService.list>;
}
export declare const dossiersService: {
    upsert(params: {
        flightId?: string;
        tailNumber?: string;
        flightDate?: string;
        pilotName?: string;
    }): Dossier;
    getById(id: string): Dossier | null;
    getByFlightId(flightId: string): Dossier | null;
    list(opts?: {
        tailNumber?: string;
        status?: DossierStatus;
        limit?: number;
        offset?: number;
    }): Dossier[];
    getWithFindings(id: string): DossierWithFindings | null;
    syncStatus(id: string): Dossier | null;
};
//# sourceMappingURL=dossiers-service.d.ts.map