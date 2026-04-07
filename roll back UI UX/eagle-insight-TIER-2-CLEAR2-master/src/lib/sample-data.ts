// Sample flight data for demonstration purposes
export interface SampleCSVRecord {
  timestamp: string;
  aircraft_tail: string;
  altitude: string;
  airspeed: string;
  engine_temp: string;
  fuel_flow: string;
  vertical_speed: string;
  engine_pressure: string;
  flight_phase: string;
  pilot_id: string;
  flight_duration: string;
  weather_condition: string;
  g_force: string;
  oil_pressure: string;
  hydraulic_pressure: string;
}

export const generateSampleFlightData = (): SampleCSVRecord[] => {
  const aircraftTails = ['251', '252', '253', '254', '255'];
  const pilotIds = ['P001', 'P002', 'P003', 'P004', 'P005'];
  const flightPhases = ['טקסי', 'המראה', 'עלייה', 'טיסת שיוט', 'ירידה', 'נחיתה'];
  const weatherConditions = ['בהיר', 'מעונן', 'גשום', 'רוח חזקה', 'ערפל'];

  const data: SampleCSVRecord[] = [];
  
  // Generate data for multiple flights over several days
  for (let day = 0; day < 7; day++) {
    for (let flightNum = 0; flightNum < 15; flightNum++) {
      const aircraft = aircraftTails[Math.floor(Math.random() * aircraftTails.length)];
      const pilot = pilotIds[Math.floor(Math.random() * pilotIds.length)];
      const weather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      
      // Generate flight data points (every 30 seconds for 2 hour flight)
      const flightDuration = 120; // minutes
      const pointsPerFlight = 240; // 30 second intervals
      
      for (let point = 0; point < pointsPerFlight; point++) {
        const timeInFlight = (point / pointsPerFlight) * flightDuration;
        const timestamp = new Date(Date.now() - (6 - day) * 24 * 60 * 60 * 1000 + timeInFlight * 60 * 1000).toISOString();
        
        // Determine flight phase based on time
        let phase = 'טיסת שיוט';
        if (timeInFlight < 5) phase = 'טקסי';
        else if (timeInFlight < 10) phase = 'המראה';
        else if (timeInFlight < 25) phase = 'עלייה';
        else if (timeInFlight > 100 && timeInFlight < 110) phase = 'ירידה';
        else if (timeInFlight >= 110) phase = 'נחיתה';
        
        // Generate realistic flight parameters based on phase
        let altitude = 0;
        let airspeed = 0;
        let verticalSpeed = 0;
        
        switch (phase) {
          case 'טקסי':
            altitude = 100 + Math.random() * 10;
            airspeed = 20 + Math.random() * 15;
            verticalSpeed = 0;
            break;
          case 'המראה':
            altitude = 100 + (timeInFlight - 5) * 200 + Math.random() * 50;
            airspeed = 120 + Math.random() * 30;
            verticalSpeed = 1500 + Math.random() * 500;
            break;
          case 'עלייה':
            altitude = 1000 + (timeInFlight - 10) * 800 + Math.random() * 100;
            airspeed = 180 + Math.random() * 40;
            verticalSpeed = 800 + Math.random() * 400;
            break;
          case 'טיסת שיוט':
            altitude = 12000 + Math.random() * 8000;
            airspeed = 450 + Math.random() * 50;
            verticalSpeed = -50 + Math.random() * 100;
            break;
          case 'ירידה':
            altitude = 20000 - (timeInFlight - 100) * 1800 + Math.random() * 200;
            airspeed = 300 + Math.random() * 80;
            verticalSpeed = -1200 + Math.random() * 400;
            break;
          case 'נחיתה':
            altitude = Math.max(100, 2000 - (timeInFlight - 110) * 190 + Math.random() * 50);
            airspeed = Math.max(80, 200 - (timeInFlight - 110) * 12 + Math.random() * 20);
            verticalSpeed = -500 + Math.random() * 200;
            break;
        }
        
        // Add some aircraft-specific variations and anomalies
        const aircraftFactor = aircraft === '253' ? 1.1 : aircraft === '255' ? 0.95 : 1.0;
        
        // Engine parameters
        const baseEngineTemp = 650 + Math.random() * 100;
        const engineTemp = phase === 'המראה' ? baseEngineTemp + 50 : baseEngineTemp;
        
        const baseFuelFlow = 2000 + Math.random() * 500;
        const fuelFlow = phase === 'המראה' || phase === 'עלייה' ? baseFuelFlow * 1.3 : baseFuelFlow * 0.8;
        
        // Add some anomalies for aircraft 253 (maintenance issues)
        const hasAnomaly = aircraft === '253' && Math.random() < 0.02;
        const anomalyMultiplier = hasAnomaly ? (1.2 + Math.random() * 0.3) : 1.0;
        
        // Weather effects
        const weatherFactor = weather === 'רוח חזקה' ? 1.15 : weather === 'גשום' ? 1.1 : 1.0;
        
        const gForce = phase === 'המראה' || phase === 'נחיתה' ? 1.2 + Math.random() * 0.3 : 0.9 + Math.random() * 0.2;
        
        data.push({
          timestamp,
          aircraft_tail: aircraft,
          altitude: Math.round(altitude).toString(),
          airspeed: Math.round(airspeed * weatherFactor).toString(),
          engine_temp: Math.round(engineTemp * anomalyMultiplier * aircraftFactor).toString(),
          fuel_flow: Math.round(fuelFlow * aircraftFactor).toString(),
          vertical_speed: Math.round(verticalSpeed).toString(),
          engine_pressure: Math.round((45 + Math.random() * 10) * anomalyMultiplier).toString(),
          flight_phase: phase,
          pilot_id: pilot,
          flight_duration: Math.round(timeInFlight).toString(),
          weather_condition: weather,
          g_force: (gForce * weatherFactor).toFixed(2),
          oil_pressure: Math.round((35 + Math.random() * 8) * anomalyMultiplier).toString(),
          hydraulic_pressure: Math.round((3000 + Math.random() * 200) * anomalyMultiplier).toString()
        });
      }
    }
  }
  
  return data;
};

export const sampleDataHeaders = [
  'timestamp',
  'aircraft_tail', 
  'altitude',
  'airspeed',
  'engine_temp',
  'fuel_flow',
  'vertical_speed',
  'engine_pressure',
  'flight_phase',
  'pilot_id',
  'flight_duration',
  'weather_condition',
  'g_force',
  'oil_pressure',
  'hydraulic_pressure'
];

// Convert sample data to CSV format
export const convertSampleDataToCSV = (data: SampleCSVRecord[]): string => {
  const headers = sampleDataHeaders.join(',');
  const rows = data.map(record => 
    sampleDataHeaders.map(header => record[header as keyof SampleCSVRecord]).join(',')
  );
  return [headers, ...rows].join('\n');
};