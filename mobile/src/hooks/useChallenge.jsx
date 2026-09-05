import { useState } from 'react';

const challengeTypes = {
  math: 'Math Problem',
  logic: 'Logic Puzzle', 
  memory: 'Sequence Memory',
  word: 'Word Construction',
  pattern: 'Pattern Recognition',
  riddle: 'Riddle',
  quickquiz: 'Quick Quiz'
};

const difficulties = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function useChallenge() {
  const [isActive, setIsActive] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(null);

  const generateChallenge = (typeKey = 'math') => {
    const type = challengeTypes[typeKey] || challengeTypes.math;
    const difficulty = difficulties[getRandomInt(0, difficulties.length - 1)];
    
    let question, answer;
    
    switch (typeKey) {
      case 'math':
        const a = getRandomInt(1, 12);
        const b = getRandomInt(1, 12);
        question = `What is ${a} × ${b}?`;
        answer = a * b;
        break;
        
      case 'logic':
        const sequence = [getRandomInt(1, 20), getRandomInt(1, 20), getRandomInt(1, 20)];
        const diff = sequence[1] - sequence[0] === sequence[2] - sequence[1] ? 'continue' : 'break';
        question = `Find the next number: ${sequence.join('-')}`;
        answer = diff === 'continue' ? sequence[2] + (sequence[1] - sequence[0]) : '?';
        break;
        
      case 'memory':
        const pattern = [];
        for (let i = 0; i < 3; i++) pattern.push(getRandomInt(0, 3));
        question = `Memorize: ${pattern.join('-')}`;
        answer = JSON.stringify(pattern);
        break;
        
      case 'word':
        const vowels = 'aeiou';
        const cons = 'bcdfghj';
        const word = `${vowels[getRandomInt(0, 5)]}${cons[getRandomInt(0, 7)]}${vowels[getRandomInt(0, 5)]}${cons[getRandomInt(0, 7)]}${vowels[getRandomInt(0, 5)]}`;
        question = `Unscramble: ${word.split('').sort(() => Math.random() - 0.5).join('')}`;
        answer = word;
        break;
        
      case 'pattern':
        const shapes = ['circle', 'square', 'triangle'];
        const patternSeq = [];
        for (let i = 0; i < 3; i++) patternSeq.push(shapes[getRandomInt(0, 3)]);
        question = `Pattern: ${patternSeq.join('-')}`;
        answer = JSON.stringify(patternSeq);
        break;
        
      case 'riddle':
        const riddles = [
          'What has keys but can\'t open locks? (answer: piano)',
          'What comes once in a minute, twice in a moment, but never in a thousand years? (answer: the letter M)',
          'What can travel around the world while staying in a corner? (answer: stamp)'
        ];
        const riddleObj = riddles[getRandomInt(0, riddles.length - 1)];
        const [riddleQ, riddleA] = riddleObj.split('? ');
        question = `${riddleQ}?`;
        answer = riddleA;
        break;
        
      case 'quickquiz':
        const score = getRandomInt(3, 10);
        question = `Quick Quiz: How many seconds in 5 minutes?`;
        answer = 300;
        break;
        
      default:
        question = 'Math Problem';
        answer = 42;
    }
    
    setIsActive(true);
    setCurrentChallenge({ question, type: typeKey, difficulty, answer });
    
    // Return the challenge for immediate use
    return { question, type: typeKey, difficulty, answer };
  };

  const completeChallenge = async (result) => {
    const { answer: correctAnswer } = currentChallenge;
    const isCorrect = String(result.answer || result) === String(correctAnswer);
    
    setIsActive(false);
    setCurrentChallenge(null);
    
    return { correct: isCorrect, answer: correctAnswer, question: currentChallenge?.question };
  };

  return { generateChallenge, isChallengeActive: isActive, completeChallenge };
}