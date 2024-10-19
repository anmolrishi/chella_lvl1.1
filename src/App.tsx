import React, { useState, useEffect } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { motion } from 'framer-motion';
import {
  ChakraProvider,
  extendTheme,
  Box,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Textarea,
  Input,
  Select,
  Button,
  Flex,
  Text,
  useToast,
} from '@chakra-ui/react';
import { Podcast, Edit } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';

const theme = extendTheme({
  fonts: {
    body: '"Kanit", sans-serif',
    heading: '"Kanit", sans-serif',
  },
  colors: {
    neonGreen: {
      50: '#E6FFF0',
      100: '#B3FFD1',
      200: '#80FFB3',
      300: '#4DFF94',
      400: '#1AFF75',
      500: '#00E664',
      600: '#00B34F',
      700: '#00803A',
      800: '#004D24',
      900: '#001A0F',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.100',
        color: 'black',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'md',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      },
      variants: {
        solid: {
          bg: 'black',
          color: 'white',
          _hover: {
            bg: 'neonGreen.500',
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderColor: 'gray.300',
            _focus: {
              borderColor: 'neonGreen.500',
              boxShadow: '0 0 0 1px #00E664',
            },
            _hover: {
              borderColor: 'gray.400',
            },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          borderColor: 'gray.300',
          _focus: {
            borderColor: 'neonGreen.500',
            boxShadow: '0 0 0 1px #00E664',
          },
          _hover: {
            borderColor: 'gray.400',
          },
        },
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            borderColor: 'gray.300',
            _focus: {
              borderColor: 'neonGreen.500',
              boxShadow: '0 0 0 1px #00E664',
            },
            _hover: {
              borderColor: 'gray.400',
            },
          },
        },
      },
    },
  },
});

const webClient = new RetellWebClient();
const YOUR_API_KEY = 'key_1d2025c27c6328b3f9840255e4df';

interface LLMData {
  llm_id: string;
  llm_websocket_url: string;
}

interface AgentData {
  agent_id: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [generalPrompt, setGeneralPrompt] = useState<string>('');
  const [beginMessage, setBeginMessage] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [llmData, setLLMData] = useState<LLMData | null>(null);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [callStatus, setCallStatus] = useState<
    'not-started' | 'active' | 'inactive'
  >('not-started');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.uid);
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    webClient.on('conversationStarted', () => {
      console.log('Conversation started');
      setCallStatus('active');
    });

    webClient.on('conversationEnded', ({ code, reason }) => {
      console.log('Conversation ended with code:', code, ', reason:', reason);
      setCallStatus('inactive');
    });

    webClient.on('error', (error) => {
      console.error('An error occurred:', error);
      setCallStatus('inactive');
    });

    webClient.on('update', (update) => {
      if (update.type === 'transcript' && update.transcript) {
        console.log(`${update.transcript.speaker}: ${update.transcript.text}`);
      }
    });
  }, []);

  const loadUserData = async (userId: string) => {
    let retries = 5;
    const retryInterval = 1000; // 1 second

    const tryLoadData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setGeneralPrompt(data.generalPrompt || '');
          setBeginMessage(data.beginMessage || '');
          setModel(data.model || '');
          setLLMData(data.llmData || null);
          setAgentData(data.agentData || null);
          setIsLoading(false);
        } else {
          if (retries > 0) {
            retries--;
            setTimeout(tryLoadData, retryInterval);
          } else {
            console.error('User document not found after retries');
            toast({
              title: 'Error loading user data',
              description:
                'User document not found. Please try logging out and back in.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        if (retries > 0) {
          retries--;
          setTimeout(tryLoadData, retryInterval);
        } else {
          toast({
            title: 'Error loading user data',
            description:
              'An error occurred while loading your data. Please try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          setIsLoading(false);
        }
      }
    };

    tryLoadData();
  };

  const updateLLM = async () => {
    if (!user || !llmData) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();

      // Update LLM first
      const response = await fetch(
        `https://api.retellai.com/update-retell-llm/${llmData.llm_id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${YOUR_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            general_prompt: generalPrompt,
            begin_message: beginMessage,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedLLMData = await response.json();

      // Update Firestore with new LLM data
      await setDoc(
        doc(db, 'users', user.uid),
        {
          ...userData,
          generalPrompt,
          beginMessage,
          model,
          llmData: updatedLLMData, // Update llmData with the new values from the API response
        },
        { merge: true }
      );

      setLLMData(updatedLLMData);
      setIsEditing(false);
      toast({
        title: 'LLM updated successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating LLM:', error);
      toast({
        title: 'Error updating LLM',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const toggleConversation = async () => {
    if (callStatus === 'active') {
      webClient.stopCall();
      setCallStatus('inactive');
    } else {
      if (!agentData) {
        console.error('Agent not created yet');
        return;
      }

      try {
        const response = await fetch(
          'https://api.retellai.com/v2/create-web-call',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${YOUR_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agent_id: agentData.agent_id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        webClient
          .startCall({
            accessToken: data.access_token,
            callId: data.call_id,
            sampleRate: 16000,
            enableUpdate: true,
          })
          .catch(console.error);
        setCallStatus('active');
      } catch (error) {
        console.error('Error starting call:', error);
      }
    }
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  if (isLoading) {
    return (
      <ChakraProvider theme={theme}>
        <Box
          minHeight="100vh"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="xl">Loading...</Text>
        </Box>
      </ChakraProvider>
    );
  }

  return (
    <ChakraProvider theme={theme}>
      <Box minHeight="100vh" bg="gray.100">
        {user ? (
          <>
            <Navbar />
            <Box py={8}>
              <Flex
                maxWidth="1200px"
                margin="0 auto"
                gap={8}
                flexDirection={{ base: 'column', md: 'row' }}
              >
                {/* Left Side: Prompt Editor */}
                <Box
                  width={{ base: '100%', md: '60%' }}
                  bg="white"
                  p={8}
                  borderRadius="xl"
                  boxShadow="lg"
                  position="relative"
                  overflow="hidden"
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    height="4px"
                    bg="neonGreen.500"
                  />
                  <Flex
                    justifyContent="space-between"
                    alignItems="center"
                    mb={8}
                  >
                    <Heading as="h1" size="xl" color="black">
                      Call Assistant Configuration
                    </Heading>
                    <Button onClick={toggleEdit} leftIcon={<Edit size={16} />}>
                      {isEditing ? 'Cancel' : 'Edit'}
                    </Button>
                  </Flex>
                  <VStack spacing={6} align="stretch">
                    <FormControl>
                      <FormLabel color="black" fontWeight="medium">
                        General Prompt
                      </FormLabel>
                      {isEditing ? (
                        <Textarea
                          value={generalPrompt}
                          onChange={(e) => setGeneralPrompt(e.target.value)}
                          rows={4}
                          bg="white"
                          color="black"
                        />
                      ) : (
                        <Box p={2} bg="gray.100" borderRadius="md">
                          {generalPrompt}
                        </Box>
                      )}
                    </FormControl>
                    <FormControl>
                      <FormLabel color="black" fontWeight="medium">
                        Begin Message
                      </FormLabel>
                      {isEditing ? (
                        <Input
                          type="text"
                          value={beginMessage}
                          onChange={(e) => setBeginMessage(e.target.value)}
                          bg="white"
                          color="black"
                        />
                      ) : (
                        <Box p={2} bg="gray.100" borderRadius="md">
                          {beginMessage}
                        </Box>
                      )}
                    </FormControl>
                    <FormControl>
                      <FormLabel color="black" fontWeight="medium">
                        Model Selection
                      </FormLabel>
                      {isEditing ? (
                        <Select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          bg="white"
                          color="black"
                        >
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o-Mini</option>
                          <option value="claude-3.5-sonnet">
                            {' '}
                            Claude-3.5-Sonnet{' '}
                          </option>
                          <option value="claude-3-haiku">
                            {' '}
                            Claude-3-Haiku
                          </option>
                        </Select>
                      ) : (
                        <Box p={2} bg="gray.100" borderRadius="md">
                          {model}
                        </Box>
                      )}
                    </FormControl>
                    {isEditing && (
                      <Button onClick={updateLLM} size="lg" width="100%">
                        Save Changes
                      </Button>
                    )}
                  </VStack>
                </Box>

                {/* Right Side: Phone Icon */}
                <Flex
                  width={{ base: '100%', md: '40%' }}
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    bgGradient="radial(circle at center, rgba(26, 255, 125, 0.1) 0%, transparent 70%)"
                    filter="blur(40px)"
                    zIndex="0"
                  />
                  <Box
                    position="relative"
                    onClick={toggleConversation}
                    cursor="pointer"
                    zIndex="1"
                  >
                    <motion.div
                      animate={{
                        scale: callStatus === 'active' ? [1, 1.1, 1] : 1,
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: callStatus === 'active' ? Infinity : 0,
                        repeatType: 'reverse',
                      }}
                    >
                      <Box
                        bg={callStatus === 'active' ? 'neonGreen.500' : 'white'}
                        rounded="full"
                        p={16}
                        boxShadow={`0 0 20px ${
                          callStatus === 'active'
                            ? 'rgba(26, 255, 125, 0.6)'
                            : 'rgba(26, 255, 125, 0.2)'
                        }`}
                      >
                        <motion.div
                          animate={{
                            rotate: callStatus === 'active' ? [0, 360] : 0,
                          }}
                          transition={{
                            duration: 2,
                            repeat: callStatus === 'active' ? Infinity : 0,
                            ease: 'linear',
                          }}
                        >
                          <Podcast
                            size={110}
                            color={
                              callStatus === 'active' ? 'white' : 'LightGreen'
                            }
                          />
                        </motion.div>
                      </Box>
                    </motion.div>
                    {callStatus === 'active' && (
                      <Box
                        position="absolute"
                        top="-12px"
                        left="-12px"
                        right="-12px"
                        bottom="-12px"
                        rounded="full"
                        //border="4px solid"
                        //borderColor="neonGreen.400"
                        opacity={0.5}
                        as={motion.div}
                        animate={{
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          repeatType: 'reverse',
                        }}
                      />
                    )}
                    <Text
                      position="relative"
                      paddingTop="15px"
                      left="50%"
                      transform="translateX(-50%)"
                      fontSize="xl"
                      fontWeight="semibold"
                      color="black"
                      textAlign="center"
                    >
                      {callStatus === 'active'
                        ? 'Agent Listening'
                        : 'Test Call Agent'}
                    </Text>
                  </Box>
                </Flex>
              </Flex>
            </Box>
          </>
        ) : showAuth ? (
          <Auth onBackToLanding={() => setShowAuth(false)} />
        ) : (
          <LandingPage onGetStarted={() => setShowAuth(true)} />
        )}
      </Box>
    </ChakraProvider>
  );
}
