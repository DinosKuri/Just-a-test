import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Dimensions, Platform } from 'react-native';

export const getDeviceInfo = async () => {
  const { width, height } = Dimensions.get('window');
  
  let deviceId = 'unknown';
  try {
    if (Platform.OS === 'android') {
      deviceId = Application.getAndroidId() || 'android-unknown';
    } else if (Platform.OS === 'ios') {
      deviceId = await Application.getIosIdForVendorAsync() || 'ios-unknown';
    } else {
      deviceId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  } catch (error) {
    deviceId = `fallback-${Date.now()}`;
  }

  return {
    device_id: deviceId,
    os: Platform.OS,
    os_version: Platform.Version?.toString() || 'unknown',
    device_name: Device.deviceName || 'Unknown Device',
    device_model: Device.modelName || 'Unknown Model',
    brand: Device.brand || 'Unknown Brand',
    screen_width: width,
    screen_height: height,
    is_device: Device.isDevice,
  };
};
