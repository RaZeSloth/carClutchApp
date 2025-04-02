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
const ROLLING_RESISTANCE = 0.995;
const AIR_RESISTANCE = 0.0002;
const IDLE_RPM = 800;
const STALL_RPM = 500;
const MAX_RPM = 8000;
const RPM_CHANGE_RATE = 50; // Increased for more responsive RPM changes
const CLUTCH_SLIP_FACTOR = 0.7;
const POWER_TRANSFER_RATE = 0.1; // Added for smoother power transfer

export default function Index() {
  const [rpm, setRpm] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [currentGear, setCurrentGear] = useState<Gear>(0);
  const [clutchPosition, setClutchPosition] = useState(1); // Start with clutch pressed
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
    
    const targetGear = newGear as Exclude<Gear, -1 | 0>;
    const { minRpm, maxRpm } = gearRatios[targetGear];
    
    // More realistic gear change logic
    if (currentGear > 0) {
      const currentRatio = gearRatios[currentGear as Exclude<Gear, -1 | 0>].ratio;
      const newRatio = gearRatios[targetGear].ratio;
      const expectedRpm = rpm * (newRatio / currentRatio);
      
      if (expectedRpm < minRpm * 0.7) {
        setIsStalled(true);
        setRpm(0);
        return;
      }
      
      if (expectedRpm > maxRpm * 1.2) {
        return; // Prevent gear change if RPM would be too high
      }
      
      setRpm(Math.min(MAX_RPM, Math.max(IDLE_RPM, expectedRpm)));
    }
    
    setCurrentGear(newGear);
  };

  const updatePhysics = () => {
    if (!isEngineRunning) return;
  
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
  
    // Stalling logic
    if (rpm < STALL_RPM && currentGear !== 0 && clutchPosition < 0.2) {
      setIsStalled(true);
      setRpm(0);
      return;
    }
  
    // Restart logic
    if (isStalled && clutchPosition > 0.8) {
      setIsStalled(false);
      setRpm(IDLE_RPM);
    }
  
    // RPM calculation
    if (!isStalled) {
      setRpm(prevRpm => {
        let newRpm = prevRpm;
  
        // Base engine behavior (without any load)
        const engineTargetRpm = IDLE_RPM + (gasPosition * (MAX_RPM - IDLE_RPM));
        
        if (currentGear === 0) {
          // Neutral gear - engine follows gas pedal freely
          newRpm += (engineTargetRpm - newRpm) * 0.3;
        } 
        else if (clutchPosition > 0.8) {
          // Clutch fully pressed - engine follows gas pedal freely
          newRpm += (engineTargetRpm - newRpm) * 0.3;
        }
        else {
          // In gear with clutch engaged
          const { ratio, minRpm, maxRpm } = gearRatios[currentGear as Exclude<Gear, -1 | 0>];
          const wheelRpm = (speed * ratio * 100) / 60; // RPM based on current speed
          
          // When clutch is fully released (clutchPosition < 0.2)
          if (clutchPosition < 0.2) {
            // RPM is primarily determined by wheel speed
            newRpm = wheelRpm;
            
            // Gas pedal can increase RPM slightly beyond wheel speed
            if (gasPosition > 0) {
              newRpm += gasPosition * 500 * deltaTime;
            }
          }
          else {
            // Clutch is partially engaged - blend between wheel speed and engine power
            const clutchEffect = Math.pow(clutchPosition, 3); // More sensitivity at high clutch values
            newRpm = wheelRpm * (1 - clutchEffect) + engineTargetRpm * clutchEffect;
          }
  
          // Enforce gear-specific RPM limits
          newRpm = Math.max(minRpm * 0.8, Math.min(maxRpm, newRpm));
        }
  
        // Small random fluctuations at idle
        if (gasPosition === 0 && Math.abs(newRpm - IDLE_RPM) < 100) {
          newRpm += (Math.random() - 0.5) * 20;
        }
  
        return Math.min(MAX_RPM, Math.max(0, newRpm));
      });
    }
  
    // Speed calculation
    setSpeed(prevSpeed => {
      let newSpeed = prevSpeed;
      
      // Apply resistance
      newSpeed *= ROLLING_RESISTANCE;
      newSpeed -= newSpeed * newSpeed * AIR_RESISTANCE;
      
      // Only apply power when in gear, clutch engaged, and not stalled
      if (currentGear > 0 && clutchPosition < 0.2 && !isStalled) {
        const { ratio } = gearRatios[currentGear as Exclude<Gear, -1 | 0>];
        const effectiveRpm = rpm * (1 - clutchPosition);
        const power = (effectiveRpm / ratio) * (gasPosition > 0 ? gasPosition : 0.1);
        newSpeed += power * POWER_TRANSFER_RATE * deltaTime;
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