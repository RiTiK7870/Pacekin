import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/config';
import WelcomeScreen from '../screens/WelcomeScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import RunTrackerScreen from '../screens/RunTrackerScreen';
import AICoachScreen from '../screens/AICoachScreen';
import AdminEventsScreen from '../screens/AdminEventsScreen';
import AdminEventFormScreen from '../screens/AdminEventFormScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import AdminChallengesScreen from '../screens/AdminChallengesScreen';
import GroupsScreen from '../screens/GroupsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import FriendsScreen from '../screens/FriendsScreen';
import RunnerProfileScreen from '../screens/RunnerProfileScreen';
import ReportRunnerScreen from '../screens/ReportRunnerScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import CommunityRoomsScreen from '../screens/CommunityRoomsScreen';
import ModerationQueueScreen from '../screens/ModerationQueueScreen';
import ModerationCaseScreen from '../screens/ModerationCaseScreen';
import AccountStandingScreen from '../screens/AccountStandingScreen';
import AppealScreen from '../screens/AppealScreen';
import SuspendedScreen from '../screens/SuspendedScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import EditGroupScreen from '../screens/EditGroupScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom navigation per PRD section 6: Home, Explore, Activity, Profile.
const icons: Record<string, [string, string]> = {
  Home: ['home', 'home-outline'], Explore: ['compass', 'compass-outline'],
  Activity: ['pulse', 'pulse-outline'], Profile: ['person', 'person-outline'],
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.emeraldDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 64, paddingBottom: 8, borderTopColor: colors.border },
        tabBarIcon: ({ focused, color, size }) => {
          const [on, off] = icons[route.name];
          return <Ionicons name={(focused ? on : off) as any} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { session, profile, loading, suspension } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest }}><ActivityIndicator color="#fff" /></View>;
  }
  if (session && suspension) return <SuspendedScreen />;
  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg } };
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : !profile?.full_name ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={Tabs} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: true, title: 'Event', headerTintColor: colors.forest }} />
            <Stack.Screen name="RunTracker" component={RunTrackerScreen} />
            <Stack.Screen name="AICoach" component={AICoachScreen} options={{ headerShown: true, title: 'AI Coach', headerTintColor: colors.forest }} />
            <Stack.Screen name="AdminEvents" component={AdminEventsScreen} options={{ headerShown: true, title: 'Manage events', headerTintColor: colors.forest }} />
            <Stack.Screen name="AdminEventForm" component={AdminEventFormScreen} options={{ headerShown: true, title: 'Event', headerTintColor: colors.forest }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications', headerTintColor: colors.forest }} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: true, title: 'Leaderboard', headerTintColor: colors.forest }} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ headerShown: true, title: 'Achievements', headerTintColor: colors.forest }} />
            <Stack.Screen name="Challenges" component={ChallengesScreen} options={{ headerShown: true, title: 'Challenges', headerTintColor: colors.forest }} />
            <Stack.Screen name="AdminChallenges" component={AdminChallengesScreen} options={{ headerShown: true, title: 'Manage challenges', headerTintColor: colors.forest }} />
            <Stack.Screen name="Groups" component={GroupsScreen} options={{ headerShown: true, title: 'Running groups', headerTintColor: colors.forest }} />
            <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ headerShown: true, title: 'Create a group', headerTintColor: colors.forest }} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ headerShown: true, title: 'Group', headerTintColor: colors.forest }} />
            <Stack.Screen name="GroupChat" component={GroupChatScreen} options={({ route }: any) => ({ headerShown: true, title: route.params?.name ?? 'Group chat', headerTintColor: colors.forest })} />
            <Stack.Screen name="Friends" component={FriendsScreen} options={{ headerShown: true, title: 'Friends', headerTintColor: colors.forest }} />
            <Stack.Screen name="RunnerProfile" component={RunnerProfileScreen} options={{ headerShown: true, title: 'Runner', headerTintColor: colors.forest }} />
            <Stack.Screen name="ReportRunner" component={ReportRunnerScreen} options={{ headerShown: true, title: 'Report', headerTintColor: colors.forest }} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: true, title: 'Privacy and blocking', headerTintColor: colors.forest }} />
            <Stack.Screen name="DirectChat" component={GroupChatScreen} options={({ route }: any) => ({ headerShown: true, title: route.params?.name ?? 'Message', headerTintColor: colors.forest })} />
            <Stack.Screen name="CommunityRooms" component={CommunityRoomsScreen} options={{ headerShown: true, title: 'Community rooms', headerTintColor: colors.forest }} />
            <Stack.Screen name="ModerationQueue" component={ModerationQueueScreen} options={{ headerShown: true, title: 'Moderation', headerTintColor: colors.forest }} />
            <Stack.Screen name="ModerationCase" component={ModerationCaseScreen} options={{ headerShown: true, title: 'Case', headerTintColor: colors.forest }} />
            <Stack.Screen name="AccountStanding" component={AccountStandingScreen} options={{ headerShown: true, title: 'Account standing', headerTintColor: colors.forest }} />
            <Stack.Screen name="Appeal" component={AppealScreen} options={{ headerShown: true, title: 'Appeal', headerTintColor: colors.forest }} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: true, title: 'Dashboard', headerTintColor: colors.forest }} />
            <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ headerShown: true, title: 'Audit log', headerTintColor: colors.forest }} />
            <Stack.Screen name="EditGroup" component={EditGroupScreen} options={{ headerShown: true, title: 'Edit group', headerTintColor: colors.forest }} />
            <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ headerShown: true, title: 'Edit profile', headerTintColor: colors.forest }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
