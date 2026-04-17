import React from 'react';
import { X, Lock, Zap, Clock, Timer, CreditCard, Gem } from 'lucide-react';
import clsx from 'clsx';
import { MAX_UNLOCKED_ATTRIBUTE_SLOTS } from '../constants/deckPool';

interface SkillTreeProps {
  money: number;
  diamonds: number;
  onClose: () => void;
  skillMaxFlips: number;
  skillRecoverSpeed: number;
  skillAutoFlipSpeed: number;
  skill6Cards: boolean;
  skill7Cards: boolean;
  unlockedAttributeSlots: number;
  upgradeSkill: (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => boolean;
  getSkillCost: (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => number;
  getMaxFlips: () => number;
  getRecoverInterval: () => number;
  getAutoFlipDuration: () => number;
  getAttributeSlotUnlockCost: () => number;
}

export const SkillTree: React.FC<SkillTreeProps> = ({ 
  money,
  diamonds, 
  onClose, 
  skillMaxFlips, 
  skillRecoverSpeed, 
  skillAutoFlipSpeed,
  skill6Cards,
  skill7Cards,
  unlockedAttributeSlots,
  upgradeSkill,
  getSkillCost,
  getMaxFlips,
  getRecoverInterval,
  getAutoFlipDuration,
  getAttributeSlotUnlockCost
}) => {
  const skills = [
    {
      id: 'maxFlips' as const,
      name: '体力上限',
      description: `每级+1，最高30 (当前: ${getMaxFlips()})`,
      icon: Zap,
      level: skillMaxFlips,
      maxLevel: 10,
      isBoolean: false,
    },
    {
      id: 'recoverSpeed' as const,
      name: '体力恢复速度',
      description: `每级-3秒 (当前: ${(getRecoverInterval() / 1000).toFixed(1)}秒)`,
      icon: Clock,
      level: skillRecoverSpeed,
      maxLevel: 10,
      isBoolean: false,
    },
    {
      id: 'autoFlipSpeed' as const,
      name: '自动翻牌速度',
      description: `每级-0.3秒 (当前: ${(getAutoFlipDuration() / 1000).toFixed(1)}秒)`,
      icon: Timer,
      level: skillAutoFlipSpeed,
      maxLevel: 10,
      isBoolean: false,
    },
    {
      id: '6Cards' as const,
      name: '6张玩法',
      description: '每次翻开6张，选择5张最大组合',
      icon: CreditCard,
      level: skill6Cards ? 1 : 0,
      maxLevel: 1,
      isBoolean: true,
    },
    {
      id: '7Cards' as const,
      name: '7张玩法',
      description: '每次翻开7张，选择5张最大组合',
      icon: CreditCard,
      level: skill7Cards ? 1 : 0,
      maxLevel: 1,
      isBoolean: true,
    },
    {
      id: 'attributeSlot' as const,
      name: '上阵卡池扩展',
      description: `解锁一个属性牌位置 (当前: ${unlockedAttributeSlots}/${MAX_UNLOCKED_ATTRIBUTE_SLOTS})`,
      icon: Lock,
      level: unlockedAttributeSlots - 20, // 初始20格，每解锁+1级
      maxLevel: MAX_UNLOCKED_ATTRIBUTE_SLOTS - 20,
      isBoolean: false,
    },
  ];

  const handleUpgrade = (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => {
    upgradeSkill(skillId);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border-2 border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">技能树</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Skills Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {skills.map((skill) => {
              const Icon = skill.icon;
              const cost = skill.id === 'attributeSlot' ? getAttributeSlotUnlockCost() : getSkillCost(skill.id);
              // 6Cards、7Cards、attributeSlot 使用钻石，其他使用金钱
              const usesDiamonds = skill.id === '6Cards' || skill.id === '7Cards' || skill.id === 'attributeSlot';
              const canAfford = usesDiamonds ? diamonds >= cost : money >= cost;
              const isMaxLevel = skill.level >= skill.maxLevel;
              
              return (
                <div 
                  key={skill.id}
                  className={clsx(
                    "relative p-3 sm:p-4 rounded-lg border-2 transition-all",
                    skill.level > 0
                      ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/50"
                      : "bg-slate-700/30 border-slate-600/50 hover:border-slate-500"
                  )}
                >
                  {/* Icon */}
                  <div className={clsx(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-3",
                    skill.level > 0
                      ? "bg-green-500 text-white" 
                      : "bg-slate-600 text-slate-300"
                  )}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  {/* Info */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 mb-1">{skill.name}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mb-2 sm:mb-3 leading-tight">{skill.description}</p>
                  
                  {/* Level Progress */}
                  {!skill.isBoolean && (
                    <div className="mb-2 sm:mb-3">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>等级 {skill.level}/{skill.maxLevel}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${(skill.level / skill.maxLevel) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upgrade Button */}
                  <button
                    onClick={() => handleUpgrade(skill.id)}
                    disabled={!canAfford || isMaxLevel}
                    className={clsx(
                      "w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all",
                      canAfford && !isMaxLevel
                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                    )}
                  >
                    {isMaxLevel ? (
                      <>已满级</>
                    ) : (
                      <>
                        {!canAfford && <Lock className="w-4 h-4" />}
                        <span>
                          {usesDiamonds ? (
                            <>升级 (<Gem className="w-4 h-4 inline" /> {cost})</>
                          ) : (
                            <>升级 (${cost})</>
                          )}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

