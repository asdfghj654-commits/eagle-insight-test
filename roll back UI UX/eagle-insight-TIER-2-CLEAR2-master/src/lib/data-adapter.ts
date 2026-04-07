// Data Adapter - Convert CSV data to FlightData format for rules/insights engines
import type { CSVRecord, ProcessedFlight } from '@/contexts/CSVDataContext';
import type { FlightData } from './rules-engine';

export class DataAdapter {
  /**
   * Convert CSV data to FlightData format for rules engine
   */
  static csvToFlightData(flight: ProcessedFlight): FlightData {
    // Group records by timestamp to build parameter arrays
    const parameters: Record<string, number[]> = {};
    const timestamps: number[] = [];
    
    // Initialize parameter arrays
    flight.parameters.forEach(param => {
      parameters[param] = [];
    });
    
    // Process each record in chronological order
    flight.records.forEach(record => {
      timestamps.push(new Date(record.timestamp).getTime());
      
      // Add parameter values (convert strings to numbers where possible)
      flight.parameters.forEach(param => {
        const value = record[param];
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        parameters[param].push(numValue);
      });
    });

    // Determine mission type based on available data or default to training
    let missionType: 'training' | 'combat' | 'weather_hard' = 'training';
    
    // Try to infer mission type from data
    if (flight.records.some(r => r.mission_type)) {
      const missionTypes = flight.records.map(r => r.mission_type).filter(Boolean);
      if (missionTypes.length > 0) {
        missionType = missionTypes[0] as any;
      }
    }

    return {
      flight_id: flight.flight_id,
      tail: flight.tail_number,
      mission_type: missionType,
      parameters,
      timestamps,
      duration_min: Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60))
    };
  }

  /**
   * Convert multiple flights to FlightData array
   */
  static processFlightsToFlightData(flights: ProcessedFlight[]): FlightData[] {
    return flights.map(flight => this.csvToFlightData(flight));
  }

  /**
   * Get parameter mapping for display names
   */
  static getParameterDisplayName(param: string): string {
    const displayNames: Record<string, string> = {
      'egt_celsius': 'טמפרטורת גזי פליטה (°C)',
      'hydraulic_pressure_psi': 'לחץ הידראולי (PSI)',
      'brake_temp_celsius': 'טמפרטורת בלמים (°C)',
      'landing_speed_kts': 'מהירות נחיתה (קשר)',
      'g_load': 'עומס G',
      'fuel_flow_pph': 'זרימת דלק (PPH)',
      'engine_temp': 'טמפרטורת מנוע (°C)',
      'oil_pressure': 'לחץ שמן (PSI)',
      'altitude_ft': 'גובה (רגל)',
      'airspeed_kts': 'מהירות אוויר (קשר)',
      'vertical_speed_fpm': 'מהירות אנכית (רגל/דקה)',
      'angle_of_attack_deg': 'זווית התקפה (מעלות)',
      'pitch_deg': 'זווית גובה (מעלות)',
      'roll_deg': 'זווית גלגול (מעלות)',
      'yaw_deg': 'זווית סטייה (מעלות)'
    };
    
    return displayNames[param] || param;
  }

  /**
   * Get system classification for parameters
   */
  static getParameterSystem(param: string): string {
    const systemMap: Record<string, string> = {
      'egt_celsius': 'מנוע',
      'engine_temp': 'מנוע',
      'oil_pressure': 'מנוע',
      'fuel_flow_pph': 'דלק',
      'hydraulic_pressure_psi': 'הידראוליקה',
      'brake_temp_celsius': 'בלמים',
      'landing_speed_kts': 'נחיתה',
      'g_load': 'מבנה',
      'altitude_ft': 'אוויניקה',
      'airspeed_kts': 'אוויניקה',
      'vertical_speed_fpm': 'אוויניקה',
      'angle_of_attack_deg': 'שליטה ובקרה',
      'pitch_deg': 'שליטה ובקרה',
      'roll_deg': 'שליטה ובקרה',
      'yaw_deg': 'שליטה ובקרה'
    };
    
    return systemMap[param] || 'כללי';
  }

  /**
   * Get parameter units
   */
  static getParameterUnits(param: string): string {
    const unitsMap: Record<string, string> = {
      'egt_celsius': '°C',
      'engine_temp': '°C',
      'brake_temp_celsius': '°C',
      'hydraulic_pressure_psi': 'PSI',
      'oil_pressure': 'PSI',
      'fuel_flow_pph': 'PPH',
      'landing_speed_kts': 'קשר',
      'airspeed_kts': 'קשר',
      'g_load': 'G',
      'altitude_ft': 'רגל',
      'vertical_speed_fpm': 'רגל/דקה',
      'angle_of_attack_deg': '°',
      'pitch_deg': '°',
      'roll_deg': '°',
      'yaw_deg': '°'
    };
    
    return unitsMap[param] || '';
  }
}