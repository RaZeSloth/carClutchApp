import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PanGestureHandler } from "react-native-gesture-handler";
import styles from "./styles";
import GearShifter from "../components/GearShifter";

type Gear = -1 | 0 | 1 | 2 | 3 | 4 | 5;
type GearRatio = { ratio: number; maxRpm: number; minRpm: number };
type GearRatios = Record<Exclude<Gear, -1 | 0>, GearRatio>;

// Constants for physics simulation
const ENGINE_BRAKING = 0.98;
const ROLLING_RESISTANCE = 1;
const AIR_RESISTANCE = 0.0002;
const IDLE_RPM = 800;
const STALL_RPM = 600;
const MAX_RPM = 8000;
const RPM_CHANGE_RATE = 50;
const CLUTCH_SLIP_FACTOR = 0.7;
const POWER_TRANSFER_RATE = 0.5;  // Increased from 0.1 to 0.5
const SPEED_TO_RPM_FACTOR = 100;  // Conversion factor from speed to RPM
const ENGINE_INERTIA = 0.8;       // How quickly engine RPM changes
const VEHICLE_INERTIA = 0.6;      // How quickly the vehicle responds to power changes
const ACCELERATION_FACTOR = 2.0;  // Added stronger acceleration factor

export default function Index() {
  const [rpm, setRpm] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [currentGear, setCurrentGear] = useState<Gear>(0);
  const [clutchPosition, setClutchPosition] = useState(1);
  const [gasPosition, setGasPosition] = useState(0);
  const [isStalled, setIsStalled] = useState(false);
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const lastUpdateTime = useRef<number>(Date.now());
  const gestureStartY = useRef(0);
  const gestureStartPosition = useRef(0);

  const gearRatios: GearRatios = {
    1: { ratio: 3.3, maxRpm: 4000, minRpm: 800 },
    2: { ratio: 1.9, maxRpm: 5000, minRpm: 1000 },
    3: { ratio: 1.3, maxRpm: 6000, minRpm: 1500 },
    4: { ratio: 1.0, maxRpm: 7000, minRpm: 2000 },
    5: { ratio: 0.8, maxRpm: 8000, minRpm: 2500 },
  };

  const toggleEngine = () => {
    if (isEngineRunning) {
      setIsEngineRunning(false);
      setRpm(0);
      setIsStalled(false);
    } else {
      setIsEngineRunning(true);
      setRpm(IDLE_RPM);
      setIsStalled(false);
    }
  };

  const handleGearChange = (newGear: Gear) => {
    if (!isEngineRunning || isStalled) return;
    if (clutchPosition < 0.8) return; 
    
    if (newGear === 0) {
      setCurrentGear(newGear);
      return;
    }
    
    setCurrentGear(newGear);
  };

  const updatePhysics = () => {
    if (!isEngineRunning) return;
  
    const now = Date.now();
    const deltaTime = Math.min((now - lastUpdateTime.current) / 1000, 0.1);
    lastUpdateTime.current = now;
  
    const clutchFactor = Math.pow(clutchPosition, 2);
    
    if (currentGear !== 0 && clutchFactor < 0.05) {
      const minRpmNeeded = STALL_RPM * (1 - Math.min(gasPosition * 0.7, 0.6));
      
      if (rpm < minRpmNeeded) {
        setIsStalled(true);
        setRpm(0);
        return;
      }
    }
  
    if (isStalled && clutchPosition > 0.8) {
      setIsStalled(false);
      setRpm(IDLE_RPM);
      return;
    }
  
    if (isStalled) return;
  
    setRpm(prevRpm => {
      let newRpm = prevRpm;
      
      const engineTargetRpm = IDLE_RPM + (gasPosition * (MAX_RPM - IDLE_RPM));
      
      if (currentGear === 0 || clutchPosition > 0.95) {
        newRpm += (engineTargetRpm - newRpm) * ENGINE_INERTIA * deltaTime * 10;
      } 
      else {
        const wheelRpm = currentGear === -1 ? 0 : 
          speed * SPEED_TO_RPM_FACTOR * gearRatios[Math.abs(currentGear) as Exclude<Gear, -1 | 0>].ratio;
        
        if (clutchFactor < 0.05) {
          newRpm = wheelRpm;
          
          if (gasPosition > 0) {
            const gasPower = gasPosition * 500 * deltaTime;
            newRpm += Math.min(gasPower, 200 * deltaTime);
          }
        } 
        else if (clutchFactor > 0.95) {
          newRpm += (engineTargetRpm - newRpm) * ENGINE_INERTIA * deltaTime * 10;
        } 
        else {
          const slipFactor = 1 - clutchFactor;
          
          let enginePull = (wheelRpm - newRpm) * slipFactor * deltaTime * 15;
          
          if (gasPosition > 0.1) {
            enginePull *= (1 - gasPosition * 0.7);
          }
          
          const gasPush = (engineTargetRpm - newRpm) * (clutchFactor + gasPosition * 0.5) * ENGINE_INERTIA * deltaTime * 10;
          
          newRpm += enginePull + gasPush;
        }
      }
      
      if (Math.abs(gasPosition) < 0.05 && Math.abs(newRpm - IDLE_RPM) < 100) {
        newRpm += (Math.random() - 0.5) * 10;
      }
      
      return Math.min(MAX_RPM, Math.max(0, newRpm));
    });
  
    setSpeed(prevSpeed => {
      let newSpeed = prevSpeed;
      
      newSpeed *= ROLLING_RESISTANCE;
      newSpeed -= newSpeed * newSpeed * AIR_RESISTANCE * deltaTime;
      
      if (currentGear !== 0 && !isStalled) {
        const gearRatio = gearRatios[Math.abs(currentGear) as Exclude<Gear, -1 | 0>].ratio;
        const direction = currentGear < 0 ? -1 : 1;
        
        const clutchEngagement = 1 - clutchFactor;
        
        if (clutchEngagement > 0.01) {
          const rpmFactor = rpm / MAX_RPM;
          let torqueFactor;
          
          if (rpm < IDLE_RPM) {
            torqueFactor = 0.1;
          } else if (rpm < 2000) {
            torqueFactor = 0.5 + (rpm - IDLE_RPM) / (2000 - IDLE_RPM) * 0.8;
          } else if (rpm < 5000) {
            torqueFactor = 1.3 - (rpm - 2000) / 3000 * 0.2;
          } else {
            torqueFactor = 1.1 - (rpm - 5000) / (MAX_RPM - 5000) * 0.4;
          }
          
          const engineForce = torqueFactor * (gasPosition * 2 + 0.3) * direction;
          
          const powerTransfer = engineForce * clutchEngagement * gearRatio * deltaTime * POWER_TRANSFER_RATE * ACCELERATION_FACTOR;
          
          const gearEfficiency = 1 + (6 - Math.abs(currentGear as number)) * 0.5;  
          newSpeed += powerTransfer * gearEfficiency;
          
          if (gasPosition < 0.1 && clutchEngagement > 0.8) {
            newSpeed *= ENGINE_BRAKING;
          }
          
          const wheelRpm = newSpeed * SPEED_TO_RPM_FACTOR * gearRatio;
          const rpmDifference = rpm - wheelRpm;
          
          // Apply clutch slip effect - this creates resistance when clutch is slipping
          if (Math.abs(rpmDifference) > 500 && clutchEngagement > 0.1 && clutchEngagement < 0.9) {
            // Reduce slip resistance when giving gas (easier to get moving)
            const gasReduction = 1 - Math.min(gasPosition * 0.7, 0.6);
            const slipResistance = Math.min(Math.abs(rpmDifference) / 2000, 1) * 
                                  clutchEngagement * (1 - clutchEngagement) * 4 * 
                                  gasReduction;
            
            newSpeed -= Math.sign(newSpeed) * slipResistance * deltaTime * 5;
          }
        }
      }
      
      return Math.max(0, newSpeed);
    });
  };

  useEffect(() => {
    const interval = setInterval(updatePhysics, 16);
    return () => clearInterval(interval);
  }, [currentGear, gasPosition, clutchPosition, isStalled, isEngineRunning]);

  const handlePedalGesture = (pedal: 'clutch' | 'gas', event: any) => {
    const translationY = event.nativeEvent.translationY;
    const newPosition = Math.max(0, Math.min(1, gestureStartPosition.current - (translationY / 150)));
    
    if (pedal === 'clutch') {
      setClutchPosition(newPosition);
    } else {
      setGasPosition(newPosition);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#E57373' }}>
      <View style={styles.topSection}>
        <View style={styles.gaugeContainer}>
          <View style={styles.displayBox}>
            <Text style={styles.displayText}>
              {isEngineRunning ? (isStalled ? "STALL" : `${Math.round(rpm)} RPM`) : "OFF"}
            </Text>
          </View>
          <View style={styles.displayBox}>
            <Text style={styles.displayText}>{Math.round(speed)} km/h</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.engineButton, isEngineRunning ? styles.engineOn : styles.engineOff]}
          onPress={toggleEngine}
        >
          <Text style={styles.engineButtonText}>
            {isEngineRunning ? (isStalled ? "RESTART" : "STOP") : "START"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainSection}>
        <View style={styles.pedalsSection}>
          {/* Clutch Pedal */}
          <View style={styles.pedalContainer}>
            <Text style={styles.pedalLabel}>Clutch</Text>
            <PanGestureHandler
              onGestureEvent={(event) => handlePedalGesture('clutch', event)}
              onBegan={(event) => {
                gestureStartY.current = event.nativeEvent.y as number;
                gestureStartPosition.current = clutchPosition;
              }}
            >
              <View style={styles.pedalTrack}>
                <View 
                  style={[
                    styles.pedalThumb, 
                    { 
                      top: (1 - clutchPosition) * 150,
                      backgroundColor: clutchPosition > 0.8 ? '#4CAF50' : 
                                     clutchPosition < 0.2 ? '#F44336' : '#FFC107'
                    }
                  ]} 
                />
              </View>
            </PanGestureHandler>
          </View>

          {/* Gas Pedal */}
          <View style={styles.pedalContainer}>
            <Text style={styles.pedalLabel}>Gas</Text>
            <PanGestureHandler
              onGestureEvent={(event) => handlePedalGesture('gas', event)}
              onBegan={(event) => {
                gestureStartY.current = event.nativeEvent.y as number;
                gestureStartPosition.current = gasPosition;
              }}
              onEnded={() => setGasPosition(0)}
            >
              <View style={styles.pedalTrack}>
                <View 
                  style={[
                    styles.pedalThumb, 
                    { 
                      top: (1 - gasPosition) * 150,
                      backgroundColor: gasPosition > 0.8 ? '#F44336' : '#4CAF50'
                    }
                  ]} 
                />
              </View>
            </PanGestureHandler>
          </View>
        </View>

        <View style={styles.gearSection}>
          <GearShifter 
            setCurrentGear={handleGearChange} 
            currentGear={currentGear}
            clutchPosition={clutchPosition}
            isStalled={isStalled}
            isEngineRunning={isEngineRunning}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}