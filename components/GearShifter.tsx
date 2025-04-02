// components/GearShifter.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../app/styles";

type Gear = -1 | 0 | 1 | 2 | 3 | 4 | 5;

interface GearShifterProps {
  setCurrentGear: (gear: Gear) => void;
  currentGear: Gear;
  clutchPosition: number;
  isStalled: boolean;
  isEngineRunning: boolean;
}

export default function GearShifter({ 
  setCurrentGear, 
  currentGear, 
  clutchPosition, 
  isStalled,
  isEngineRunning
}: GearShifterProps) {
  const handleGearPress = (gear: Gear) => {
    if (!isEngineRunning || isStalled) return;
    setCurrentGear(gear);
  };

  const canShift = isEngineRunning && !isStalled && clutchPosition > 0.8;

  return (
    <View style={styles.gearbox}>
      {/* Top row */}
      <View style={styles.gearRow}>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === 1 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(1)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>1</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === 3 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(3)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>3</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === 5 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(5)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>5</Text>
        </TouchableOpacity>
      </View>

      {/* Middle row (Neutral) */}
      <View style={styles.gearRowCenter}>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === 0 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(0)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>N</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom row */}
      <View style={styles.gearRow}>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === 2 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(2)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>2</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === 4 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(4)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>4</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.gearButton, 
            currentGear === -1 && styles.gearButtonActive,
            !canShift && styles.gearButtonDisabled
          ]}
          onPress={() => handleGearPress(-1)}
          disabled={!canShift}
        >
          <Text style={[styles.gearText, !canShift && styles.gearTextDisabled]}>R</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}