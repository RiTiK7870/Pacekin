import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/config';

export default function Logo({ size = 64, showName = false }: { size?: number; showName?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="speedometer" size={size * 0.6} color="#FFFFFF" />
      </View>
      {showName && <Text style={{ color: '#FFFFFF', fontSize: size * 0.3, fontWeight: '800', marginTop: 8 }}>Pacekin</Text>}
    </View>
  );
}
