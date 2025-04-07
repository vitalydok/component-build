from aiogram import types, Dispatcher, Bot
from aiogram.utils import executor
from aiogram.dispatcher.filters.state import StatesGroup, State
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from cresits import token
from quizHelper import *

bot = Bot(token=token, parse_mode="HTML")
dp = Dispatcher(bot, storage=MemoryStorage())


class UserQuiz(StatesGroup):
    user_a1 = State()
    user_a2 = State()
    user_a3 = State()
    user_a4 = State()
    user_a5 = State()

class AdminQuiz(StatesGroup):
    admin_q1 = State()
    admin_q2 = State()
    admin_q3 = State()
    admin_q4 = State()
    admin_q5 = State()


async def start(message: types.Message):
    await message.answer('Добро пожаловать в АЕ!\nСыграйте в мини игру что бы получить приз\n\nВ чат придет уведомление о начале игры')
    save_user(message.chat.id, 0)

async def game(message: types.Message, state):
    question = get_all_question()[0]
    Keyboard = types.ReplyKeyboardMarkup()
    Keyboard.add(question[2], question[3])
    Keyboard.add(question[4], question[5])
    await message.answer(f'Вопрос №1\n{question[1]}',reply_markup=Keyboard)
    await UserQuiz.user_a1.set()
    await state.update_data(correct=question[6])
    await state.update_data(points=0)

#----------------------------------------------------------
# 1 впоспрос

async def  on_user_a1(message: types.Message, state):
    question = get_all_question()[1]
    Keyboard = types.ReplyKeyboardMarkup()
    Keyboard.add(question[2], question[3])
    Keyboard.add(question[4], question[5])

    data = await state.get_data()
    if data.get('correct') == message.text:
        points = data.get('points') + 1
        await state.update_data(points=points)

    await message.answer(f'Вопрос №2\n{question[1]}',reply_markup=Keyboard)
    await UserQuiz.user_a2.set()
    await state.update_data(correct=question[6])

#----------------------------------------------------------
# 2 вопрос

async def  on_user_a2(message: types.Message, state):
    question = get_all_question()[2]
    Keyboard = types.ReplyKeyboardMarkup()
    Keyboard.add(question[2], question[3])
    Keyboard.add(question[4], question[5])

    data = await state.get_data()
    if data.get('correct') == message.text:
        points = data.get('points') + 1
        await state.update_data(points=points)

    await message.answer(f'Вопрос №3\n{question[1]}',reply_markup=Keyboard)
    await UserQuiz.user_a3.set()
    await state.update_data(correct=question[6])

#----------------------------------------------------------
# 3 впоспрос

async def  on_user_a3(message: types.Message, state):
    question = get_all_question()[3]
    Keyboard = types.ReplyKeyboardMarkup()
    Keyboard.add(question[2], question[3])
    Keyboard.add(question[4], question[5])

    data = await state.get_data()
    if data.get('correct') == message.text:
        points = data.get('points') + 1
        await state.update_data(points=points)

    await message.answer(f'Вопрос №4\n{question[1]}',reply_markup=Keyboard)
    await UserQuiz.user_a4.set()
    await state.update_data(correct=question[6])

#----------------------------------------------------------
# 4 впоспрос

async def  on_user_a4(message: types.Message, state):
    question = get_all_question()[4]
    Keyboard = types.ReplyKeyboardMarkup()
    Keyboard.add(question[2], question[3])
    Keyboard.add(question[4], question[5])

    data = await state.get_data()
    if data.get('correct') == message.text:
        points = data.get('points') + 1
        await state.update_data(points=points)

    await message.answer(f'Вопрос №5\n{question[1]}',reply_markup=Keyboard)
    await UserQuiz.user_a5.set()
    await state.update_data(correct=question[6])

#----------------------------------------------------------
# 5 впоспрос

async def  on_user_a5(message: types.Message, state):
    data = await state.get_data()
    if data.get('correct') == message.text:
        points = data.get('points') + 1
        await state.update_data(points=points)

    #сохранение очков в БД
    update_user_points(message.chat.id, data.get('points'))
    await message.answer(f'Вы ответили правильно на {data.get("points") + 1} вопросов из пяти')
    await state.finish()

#----------------------------------------------------------
# Админ

async def managers(message: types.Message):
    manager = message.text.split(' ')[1]
    if manager == '2905':
        await message.answer('Теперь ты админ!')
        save_manager(message.chat.id)
    else:
        await message.answer('Не лезь!')

#----------------------------------------------------------
#админ вопросы

async def question(message: types.Message, state):
    if get_game_state() == 'ON': #функция
        await message.answer('Сначала останови игру')
        return
    
    delet_questons()
    await message.answer('напиши 1 вопросв по этому алгоритму: вопрос-ответ1-ответ2-ответ3-ответ4-правильный ответ')
    question(message)
    await AdminQuiz.admin_q1.set()

async def question_1(message: types.Message, state):
    await message.answer('напиши 2 вопросв по этому алгоритму: вопрос-ответ1-ответ2-ответ3-ответ4-правильный ответ')
    question(message)
    await AdminQuiz.admin_q2.set()

async def question_2(message: types.Message, state):
    await message.answer('напиши 3 вопросв по этому алгоритму: вопрос-ответ1-ответ2-ответ3-ответ4-правильный ответ')
    question(message)
    await AdminQuiz.admin_q3.set()

async def question_3(message: types.Message, state):
    await message.answer('напиши 4 вопросв по этому алгоритму: вопрос-ответ1-ответ2-ответ3-ответ4-правильный ответ')
    question(message)
    await AdminQuiz.admin_q4.set()

async def question_4(message: types.Message, state):
    await message.answer('напиши 5 вопросв по этому алгоритму: вопрос-ответ1-ответ2-ответ3-ответ4-правильный ответ')
    question(message)
    await AdminQuiz.admin_q5.set()



    #подсказка как писать вопрос
    #вопрос-ответ1-ответ2-ответ3-ответ4-правильный ответ
    #split('-')

    #переключение по кон.автомат для админа



















#Д/З
#Написать функцию для остальных вопросов
#начало можем брать из верхней до вывода вопроса
#нам нужно получить данные из локально хранища и достать оттуда правильный ответ предыдущего вопроса
#сравнить с тем что выбрал пользоваль
#если правильный ответ, мы в переменную получаем из хранища количество очков пользователя и добавляем 1
#затем обновляем значение очков в хранилище
#берем часть где выводим ответ и переключаем и записываем правильный ответ





















#def register_handlers(dp: Dispatcher):
    #dp.register_message_handler(managers, commands='managers')

#register_handlers(dp)

executor.start_polling(dp, skip_updates=True)