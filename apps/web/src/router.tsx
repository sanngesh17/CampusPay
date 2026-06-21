import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginScreen } from './screens/LoginScreen';
import { JourneyDashboard } from './screens/JourneyDashboard';
import { NewJourneyPayment } from './screens/NewJourneyPayment';
import { JourneyCaseScreen } from './screens/JourneyCaseScreen';
import { LandingScreen } from './screens/LandingScreen';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <LandingScreen /> },
      { path: '/login', element: <LoginScreen /> },
      { path: '/dashboard', element: <JourneyDashboard /> },
      { path: '/payments/new', element: <NewJourneyPayment /> },
      { path: '/payments/:id', element: <JourneyCaseScreen /> },
    ],
  },
]);
