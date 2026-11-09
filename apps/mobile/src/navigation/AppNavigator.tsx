import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";

// Placeholder screen components — to be replaced with real implementations
function HomeScreen() {
  return null;
}
function EventDetailScreen() {
  return null;
}
function SponsorDashboardScreen() {
  return null;
}
function OrganizerDashboardScreen() {
  return null;
}
function ProfileScreen() {
  return null;
}

export type RootStackParamList = {
  Main: undefined;
  EventDetail: { eventId: string };
};

export type TabParamList = {
  Home: undefined;
  SponsorDashboard: undefined;
  OrganizerDashboard: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ea580c",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Discover" }} />
      <Tab.Screen
        name="SponsorDashboard"
        component={SponsorDashboardScreen}
        options={{ title: "Sponsor" }}
      />
      <Tab.Screen
        name="OrganizerDashboard"
        component={OrganizerDashboardScreen}
        options={{ title: "Organizer" }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="EventDetail"
          component={EventDetailScreen}
          options={{ headerShown: true, title: "Event Detail" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
