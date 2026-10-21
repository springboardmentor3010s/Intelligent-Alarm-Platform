import json
import os
import numpy as np

# A simple Q-Learning agent for difficulty adaptation.
# State: (Performance_Level) where 0=Low, 1=Medium, 2=High
# Action: 0=Easier, 1=Same, 2=Harder

class QLearningAgent:
    def __init__(self, state_size=3, action_size=3, lr=0.1, gamma=0.9, epsilon=0.1, model_path="q_table.json"):
        self.state_size = state_size
        self.action_size = action_size
        self.lr = lr
        self.gamma = gamma
        self.epsilon = epsilon
        if os.path.isabs(model_path):
            self.model_path = model_path
        else:
            self.model_path = os.path.join(os.path.dirname(__file__), model_path)
        self.q_table = self.load_model()
        
    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, 'r') as f:
                    q_table = json.load(f)
                return {int(k): v for k, v in q_table.items()}
            except Exception:
                pass
                
        # Initial Baseline Policy
        # Low -> Easier (0), Medium -> Same (1), High -> Harder (2)
        # We initialize Q-values so argmax matches this baseline.
        q_table = {}
        for s in range(self.state_size):
            # initialize with zeros
            q_table[s] = [0.0, 0.0, 0.0]
        
        # Encourage Low (0) -> Easier (0)
        q_table[0][0] = 1.0
        # Encourage Medium (1) -> Same (1)
        q_table[1][1] = 1.0
        # Encourage High (2) -> Harder (2)
        q_table[2][2] = 1.0
        
        return q_table
        
    def save_model(self):
        with open(self.model_path, 'w') as f:
            json.dump(self.q_table, f)

    def get_action(self, state, explore=False):
        if explore and np.random.uniform(0, 1) < self.epsilon:
            return np.random.randint(0, self.action_size)
        return np.argmax(self.q_table[state])
        
    def update(self, state, action, reward, next_state):
        best_next_action = np.argmax(self.q_table[next_state])
        td_target = reward + self.gamma * self.q_table[next_state][best_next_action]
        td_error = td_target - self.q_table[state][action]
        self.q_table[state][action] += self.lr * td_error
        self.save_model()
