/**
 * Perfil del conductor: redirige al perfil único /profile.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

const DriverProfile = () => <Navigate to="/profile" replace />;

export default DriverProfile;
