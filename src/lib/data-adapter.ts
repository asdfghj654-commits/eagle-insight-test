import type { CSVRecord, ProcessedFlight } from '@/contexts/CSVDataContext';
import type { FlightData } from './rules-engine';

export class DataAdapter {
  static csvToFlightData(flight: ProcessedFlight): FlightData {
    const parameters: Record<string, number[]> = {};
    const timestamps: number[] = [];

    flight.parameters.forEach((param) => {
      parameters[param] = [];
    });

    flight.records.forEach((record) => {
      timestamps.push(new Date(record.timestamp).getTime());

      flight.parameters.forEach((param) => {
        const value = record[param];
        const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        parameters[param].push(numericValue);
      });
    });

    let missionType: 'training' | 'combat' | 'weather_hard' = 'training';
    if (flight.records.some((record) => record.mission_type)) {
      const missionTypes = flight.records.map((record) => record.mission_type).filter(Boolean);
      if (missionTypes.length > 0) {
        missionType = missionTypes[0] as 'training' | 'combat' | 'weather_hard';
      }
    }

    return {
      flight_id: flight.flight_id,
      tail: flight.tail_number,
      mission_type: missionType,
      parameters,
      timestamps,
      duration_min: Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60)),
    };
  }

  static processFlightsToFlightData(flights: ProcessedFlight[]): FlightData[] {
    return flights.map((flight) => this.csvToFlightData(flight));
  }

  static getParameterDisplayName(param: string): string {
    const displayNames: Record<string, string> = {
      rpm: 'סל"ד מנוע',
      aoa_deg: 'זווית התקפה (מעלות)',
      egt_celsius: 'טמפרטורת גזי פליטה (°C)',
      egt_c: 'טמפרטורת גזי פליטה (°C)',
      hydraulic_pressure_psi: 'לחץ הידראולי (PSI)',
      brake_temp_celsius: 'טמפרטורת בלמים (°C)',
      landing_speed_kts: 'מהירות נחיתה (קשר)',
      g_load: 'עומס G',
      g_force: 'עומס G',
      fuel_flow_pph: 'זרימת דלק (PPH)',
      fuel_remaining_lbs: 'דלק נותר (lbs)',
      engine_temp: 'טמפרטורת מנוע (°C)',
      engine_temp_c: 'טמפרטורת מנוע (°C)',
      oil_pressure: 'לחץ שמן (PSI)',
      altitude_ft: 'גובה (רגל)',
      airspeed_kts: 'מהירות אוויר (קשר)',
      vertical_speed_fpm: 'מהירות אנכית (רגל/דקה)',
      angle_of_attack_deg: 'זווית התקפה (מעלות)',
      pitch_deg: 'זווית גובה (מעלות)',
      roll_deg: 'זווית גלגול (מעלות)',
      yaw_deg: 'זווית סבסוב (מעלות)',
      vibration_ips: 'רעידות (IPS)',
      electrical_voltage_v: 'מתח חשמלי (V)',
      cabin_pressure_psi: 'לחץ תא (PSI)',
      warnings_count: 'מספר התרעות',
      anomaly_score: 'ציון חריגה',
      latitude: 'קו רוחב',
      longitude: 'קו אורך',
    };

    return displayNames[param] || param;
  }

  static getParameterSystem(param: string): string {
    const systemMap: Record<string, string> = {
      egt_celsius: 'מנוע',
      egt_c: 'מנוע',
      rpm: 'מנוע',
      engine_temp: 'מנוע',
      engine_temp_c: 'מנוע',
      oil_pressure: 'מנוע',
      fuel_flow_pph: 'דלק',
      fuel_remaining_lbs: 'דלק',
      hydraulic_pressure_psi: 'הידראוליקה',
      brake_temp_celsius: 'בלמים',
      landing_speed_kts: 'נחיתה',
      g_load: 'מבנה',
      g_force: 'מבנה',
      altitude_ft: 'אווויוניקה',
      airspeed_kts: 'אווויוניקה',
      vertical_speed_fpm: 'אווויוניקה',
      angle_of_attack_deg: 'שליטה ובקרה',
      pitch_deg: 'שליטה ובקרה',
      roll_deg: 'שליטה ובקרה',
      yaw_deg: 'שליטה ובקרה',
      vibration_ips: 'מבנה',
      electrical_voltage_v: 'חשמל',
      cabin_pressure_psi: 'מערכות תא',
      warnings_count: 'מערכת',
      anomaly_score: 'אנליטיקה',
    };

    return systemMap[param] || 'כללי';
  }

  static getParameterUnits(param: string): string {
    const unitsMap: Record<string, string> = {
      egt_celsius: '°C',
      egt_c: '°C',
      engine_temp: '°C',
      engine_temp_c: '°C',
      brake_temp_celsius: '°C',
      hydraulic_pressure_psi: 'PSI',
      oil_pressure: 'PSI',
      fuel_flow_pph: 'PPH',
      fuel_remaining_lbs: 'lbs',
      landing_speed_kts: 'קשר',
      airspeed_kts: 'קשר',
      rpm: '%',
      g_load: 'G',
      g_force: 'G',
      altitude_ft: 'רגל',
      vertical_speed_fpm: 'רגל/דקה',
      angle_of_attack_deg: '°',
      pitch_deg: '°',
      roll_deg: '°',
      yaw_deg: '°',
      vibration_ips: 'IPS',
      electrical_voltage_v: 'V',
      cabin_pressure_psi: 'PSI',
    };

    return unitsMap[param] || '';
  }
}
