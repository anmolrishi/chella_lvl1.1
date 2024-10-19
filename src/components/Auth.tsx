import React, { useState } from 'react';
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';

const YOUR_API_KEY = 'key_1d2025c27c6328b3f9840255e4df';

const createLLMAndAgent = async () => {
  try {
    const llmResponse = await fetch(
      'https://api.retellai.com/create-retell-llm',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${YOUR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          general_prompt: 'You are a helpful assistant for our restaurant...',
          begin_message: 'Hi, I am Nala, how can I assist you today?',
        }),
      }
    );

    if (!llmResponse.ok) {
      throw new Error(`HTTP error! status: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();

    const agentResponse = await fetch('https://api.retellai.com/create-agent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${YOUR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        llm_websocket_url: llmData.llm_websocket_url,
        agent_name: 'Restaurant Assistant',
        voice_id: '11labs-Adrian',
        language: 'en-US',
      }),
    });

    if (!agentResponse.ok) {
      throw new Error(`HTTP error! status: ${agentResponse.status}`);
    }

    const agentData = await agentResponse.json();

    return {
      llmData,
      agentData,
      initialPrompt: 'You are a helpful assistant for our restaurant...',
      initialBeginMessage: 'Hi, I am Nala, how can I assist you today?',
      initialModel: 'gpt-4o',
    };
  } catch (error) {
    console.error('Error creating LLM and agent:', error);
    throw error;
  }
};

interface AuthProps {
  onBackToLanding: () => void;
}

const Auth: React.FC<AuthProps> = ({ onBackToLanding }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // Create LLM and agent
        const {
          llmData,
          agentData,
          initialPrompt,
          initialBeginMessage,
          initialModel,
        } = await createLLMAndAgent();

        // Create initial user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          generalPrompt: initialPrompt,
          beginMessage: initialBeginMessage,
          model: initialModel,
          llmData,
          agentData,
        });

        setSuccess(
          "We've created your account and initialized your assistant."
        );
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess('Logged in successfully.');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md font-sans">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
      <div className="flex items-center mb-6">
        <button
          className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200"
          onClick={onBackToLanding}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Landing Page
        </button>
      </div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {isSignUp ? 'Create an Account' : 'Log In to Your Account'}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
            placeholder="Enter your email"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
            placeholder="Enter your password"
          />
        </div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      <p className="mt-4 text-center text-sm text-gray-600">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Log In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
};

export default Auth;
