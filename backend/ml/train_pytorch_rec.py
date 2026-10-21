import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from torch.utils.data import DataLoader, TensorDataset
import os

# Define the 7 challenge types
CHALLENGE_TYPES = ["Math", "Logic", "Memory", "Word", "Pattern", "Riddle", "Quiz"]

class RecommendationNet(nn.Module):
    def __init__(self, input_size=6, hidden_size=16, num_classes=7):
        super(RecommendationNet, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, num_classes)
        
    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        out = self.relu(out)
        out = self.fc3(out)
        return out

def generate_synthetic_data(num_samples=2000):
    """
    Features:
    0: habit_score (0-100)
    1: wake_up_score (0-35)
    2: challenge_rate (0.0-1.0)
    3: snooze_count (0-10)
    4: sleep_score (0-20)
    5: trend (-1=Declining, 0=Stable, 1=Improving)
    """
    np.random.seed(42)
    X = []
    y = []
    
    for _ in range(num_samples):
        habit = np.random.uniform(0, 100)
        wake = np.random.uniform(0, 35)
        chal_rate = np.random.uniform(0, 1.0)
        snooze = np.random.randint(0, 6)
        sleep = np.random.uniform(0, 20)
        trend = np.random.choice([-1, 0, 1])
        
        feature = [habit, wake, chal_rate, snooze, sleep, trend]
        
        # Synthetic rules to map behavior to a challenge type
        if habit > 80 and trend >= 0:
            # High performers get Math(0), Logic(1), or Riddle(5)
            label = np.random.choice([0, 1, 5])
        elif chal_rate < 0.5 and trend < 0:
            # Struggling users get Memory(2) or Word(3)
            label = np.random.choice([2, 3])
        elif snooze > 2 and sleep < 10:
            # Tired users get Pattern(4) or Quiz(6) - visual/quick
            label = np.random.choice([4, 6])
        else:
            # Average users get a random mix
            label = np.random.choice([0, 1, 2, 3, 4, 5, 6])
            
        X.append(feature)
        y.append(label)
        
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int64)

def train_model():
    print("Generating synthetic PyTorch data...")
    X_np, y_np = generate_synthetic_data(5000)
    
    X_tensor = torch.from_numpy(X_np)
    y_tensor = torch.from_numpy(y_np)
    
    dataset = TensorDataset(X_tensor, y_tensor)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    model = RecommendationNet(input_size=6, hidden_size=32, num_classes=7)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.01)
    
    print("Training PyTorch Recommendation Model...")
    epochs = 50
    for epoch in range(epochs):
        for inputs, labels in loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
    # Calculate accuracy
    with torch.no_grad():
        outputs = model(X_tensor)
        _, predicted = torch.max(outputs.data, 1)
        total = y_tensor.size(0)
        correct = (predicted == y_tensor).sum().item()
        
    print(f"PyTorch Model Training Accuracy: {100 * correct / total:.2f}%")
    
    model_path = os.path.join(os.path.dirname(__file__), "pytorch_rec_model.pth")
    torch.save(model.state_dict(), model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_model()
